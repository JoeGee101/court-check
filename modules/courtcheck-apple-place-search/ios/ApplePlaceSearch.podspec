Pod::Spec.new do |s|
  s.name           = 'ApplePlaceSearch'
  s.version        = '1.0.0'
  s.summary        = 'Apple MapKit local place search for CourtCheck.'
  s.description    = 'Provides MapKit local search completions and selected place details.'
  s.license        = { :type => 'MIT' }
  s.author         = 'CourtCheck'
  s.homepage       = 'https://developer.apple.com/documentation/mapkit/mklocalsearchcompleter'
  s.source         = { :git => 'https://github.com/expo/expo.git' }
  s.platforms      = { :ios => '16.4' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.{h,m,mm,swift}'
end
