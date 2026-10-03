import ExpoModulesCore
import MapKit

public final class ApplePlaceSearchModule: Module {
  private lazy var searchManager = ApplePlaceSearchManager()

  public func definition() -> ModuleDefinition {
    Name("CourtCheckApplePlaceSearch")

    AsyncFunction("searchCompletions") {
      (query: String, requestId: Int, latitude: Double?, longitude: Double?, promise: Promise) in
      self.searchManager.searchCompletions(
        query: query,
        requestId: requestId,
        latitude: latitude,
        longitude: longitude,
        promise: promise
      )
    }.runOnQueue(.main)

    AsyncFunction("resolveCompletion") {
      (completionId: String, requestId: Int, promise: Promise) in
      self.searchManager.resolveCompletion(
        completionId: completionId,
        requestId: requestId,
        promise: promise
      )
    }.runOnQueue(.main)

    AsyncFunction("cancelSearch") { (requestId: Int) in
      self.searchManager.cancelSearch(requestId: requestId)
    }.runOnQueue(.main)
  }
}

private final class ApplePlaceSearchManager {
  private var sessions: [Int: ApplePlaceSearchSession] = [:]
  private var activeSearches: [Int: MKLocalSearch] = [:]
  private var activeSearchPromises: [Int: Promise] = [:]

  func searchCompletions(
    query: String,
    requestId: Int,
    latitude: Double?,
    longitude: Double?,
    promise: Promise
  ) {
    cancelSearch(requestId: requestId)

    let completer = MKLocalSearchCompleter()
    completer.resultTypes = [.address, .pointOfInterest]

    let region = makeSearchRegion(latitude: latitude, longitude: longitude)
    if let region {
      completer.region = region
    }

    let session = ApplePlaceSearchSession(
      requestId: requestId,
      completer: completer,
      region: region,
      promise: promise,
      manager: self
    )
    sessions[requestId] = session
    completer.delegate = session
    completer.queryFragment = query
  }

  func resolveCompletion(completionId: String, requestId: Int, promise: Promise) {
    guard
      let session = sessions[requestId],
      let completion = session.completions[completionId]
    else {
      promise.reject("ERR_APPLE_PLACE_NOT_FOUND", "The selected place is no longer available.")
      return
    }

    let request = MKLocalSearch.Request(completion: completion)
    if let region = session.region {
      request.region = region
    }

    let search = MKLocalSearch(request: request)
    activeSearches[requestId] = search
    activeSearchPromises[requestId] = promise
    search.start { [weak self, weak search] response, error in
      DispatchQueue.main.async {
        guard let self, let search, self.activeSearches[requestId] === search else {
          return
        }
        self.activeSearches[requestId] = nil
        self.activeSearchPromises[requestId] = nil

        if let error {
          self.removeSession(requestId: requestId)
          promise.reject("ERR_APPLE_PLACE_DETAILS", error.localizedDescription)
          return
        }

        guard let item = response?.mapItems.first else {
          self.removeSession(requestId: requestId)
          promise.reject("ERR_APPLE_PLACE_DETAILS", "Apple Maps did not return a place location.")
          return
        }

        let coordinate = item.placemark.coordinate
        let name = item.name?.trimmingCharacters(in: .whitespacesAndNewlines)
        let address = Self.formattedAddress(item.placemark)
        let label = (name?.isEmpty == false ? name : nil) ?? address ?? completion.title
        var result: [String: Any] = [
          "label": label,
          "latitude": coordinate.latitude,
          "longitude": coordinate.longitude
        ]
        if let name, !name.isEmpty {
          result["facilityName"] = name
        } else {
          result["facilityName"] = NSNull()
        }
        result["address"] = address ?? NSNull()

        self.removeSession(requestId: requestId)
        promise.resolve(result)
      }
    }
  }

  func cancelSearch(requestId: Int) {
    if let session = sessions[requestId] {
      if !session.hasReturnedCompletions {
        session.promise?.reject("ERR_APPLE_PLACE_SEARCH_CANCELLED", "The place search was cancelled.")
      }
      session.promise = nil
      removeSession(requestId: requestId)
    }

    if let search = activeSearches.removeValue(forKey: requestId) {
      search.cancel()
      activeSearchPromises.removeValue(forKey: requestId)?.reject(
        "ERR_APPLE_PLACE_SEARCH_CANCELLED",
        "The place search was cancelled."
      )
    }
  }

  fileprivate func didUpdate(_ session: ApplePlaceSearchSession) {
    guard sessions[session.requestId] === session, !session.hasReturnedCompletions else {
      return
    }

    let completions = Array(session.completer.results.prefix(5))
    var completionMap: [String: MKLocalSearchCompletion] = [:]
    let results: [[String: Any]] = completions.enumerated().map { index, completion in
      let id = "\(session.requestId):\(index)"
      completionMap[id] = completion
      return [
        "id": id,
        "title": completion.title,
        "subtitle": completion.subtitle
      ] as [String: Any]
    }

    session.completions = completionMap
    session.hasReturnedCompletions = true
    session.promise?.resolve(results)
    session.promise = nil
  }

  fileprivate func didFail(_ session: ApplePlaceSearchSession, error: Error) {
    guard sessions[session.requestId] === session, !session.hasReturnedCompletions else {
      return
    }

    sessions[session.requestId] = nil
    session.completer.delegate = nil
    session.completer.cancel()
    session.promise?.reject("ERR_APPLE_PLACE_SEARCH", error.localizedDescription)
    session.promise = nil
  }

  private func removeSession(requestId: Int) {
    guard let session = sessions.removeValue(forKey: requestId) else {
      return
    }
    session.completer.delegate = nil
    session.completer.cancel()
    session.promise = nil
  }

  private func makeSearchRegion(latitude: Double?, longitude: Double?) -> MKCoordinateRegion? {
    guard let latitude, let longitude else {
      return nil
    }

    guard
      latitude.isFinite,
      (-90...90).contains(latitude),
      longitude.isFinite,
      (-180...180).contains(longitude)
    else {
      return nil
    }

    let center = CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    return MKCoordinateRegion(center: center, latitudinalMeters: 80_000, longitudinalMeters: 80_000)
  }

  private static func formattedAddress(_ placemark: MKPlacemark) -> String? {
    let street = [placemark.subThoroughfare, placemark.thoroughfare]
      .compactMap(nonEmpty)
      .joined(separator: " ")
    let locality = nonEmpty(placemark.locality) ?? nonEmpty(placemark.subLocality)
    let region = [placemark.administrativeArea, placemark.postalCode]
      .compactMap(nonEmpty)
      .joined(separator: " ")
    let country = placemark.isoCountryCode?.uppercased() == "US" ? nil : nonEmpty(placemark.country)
    let parts = [nonEmpty(street), locality, nonEmpty(region), country].compactMap { $0 }
    return parts.isEmpty ? nil : parts.joined(separator: ", ")
  }

  private static func nonEmpty(_ value: String?) -> String? {
    guard let value = value?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else {
      return nil
    }
    return value
  }
}

private final class ApplePlaceSearchSession: NSObject, MKLocalSearchCompleterDelegate {
  let requestId: Int
  let completer: MKLocalSearchCompleter
  let region: MKCoordinateRegion?
  weak var manager: ApplePlaceSearchManager?
  var promise: Promise?
  var hasReturnedCompletions = false
  var completions: [String: MKLocalSearchCompletion] = [:]

  init(
    requestId: Int,
    completer: MKLocalSearchCompleter,
    region: MKCoordinateRegion?,
    promise: Promise,
    manager: ApplePlaceSearchManager
  ) {
    self.requestId = requestId
    self.completer = completer
    self.region = region
    self.promise = promise
    self.manager = manager
  }

  func completerDidUpdateResults(_ completer: MKLocalSearchCompleter) {
    manager?.didUpdate(self)
  }

  func completer(_ completer: MKLocalSearchCompleter, didFailWithError error: Error) {
    manager?.didFail(self, error: error)
  }
}
