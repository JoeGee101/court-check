import { useNavigation, useRouter } from 'expo-router';
import { usePreventRemove } from 'expo-router/build/react-navigation/native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, { Circle, type LatLng } from 'react-native-maps';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { CourtCheckSymbol } from '@/components/ui/courtcheck-symbol';
import { colors, controlHeights, radii, shadows, spacing, typeScale } from '@/constants/theme';
import {
  getAdminCurrentLocation,
  reverseGeocodeAdminFacilityAddress,
} from '@/features/admin-facilities/admin-current-location';
import {
  AdminFacilityMapEditor,
  type AdminFacilityMapEditorMode,
} from '@/features/admin-facilities/admin-facility-map-editor';
import {
  frameCheckInArea,
  frameFacilityLocation,
  LAS_VEGAS_REGION,
  regionAround,
} from '@/features/admin-facilities/admin-facility-map-camera';
import {
  CheckInAreaMarkers,
  FacilityLocationMarker,
} from '@/features/admin-facilities/admin-facility-map-markers';
import {
  createEmptyFacilityHours,
  FacilityHoursInput,
  type FacilityHoursValue,
  parseFacilityHours,
  serializeFacilityHours,
} from '@/features/admin-facilities/facility-hours-input';
import {
  AdminFacilityNotFoundError,
  getAdminFacility,
  saveAdminFacility,
  type AdminFacilityDetail,
} from '@/features/admin-facilities/admin-facilities-api';
import { isValidFacilityId } from '@/features/facilities/facilities-api';

type EditorMode = 'create' | 'edit';
type Feedback = { message: string; tone: 'error' | 'success' };
type FormErrors = Partial<Record<keyof FacilityForm, string>>;

type FacilityForm = {
  name: string;
  address: string;
  hours: FacilityHoursValue;
  courtCount: string;
  verifiedBy: string;
  hasLights: boolean;
  hasRestrooms: boolean;
  hasWater: boolean;
  latitude: string;
  longitude: string;
  geofenceLatitude: string;
  geofenceLongitude: string;
  radiusM: string;
  isActive: boolean;
};

const EMPTY_FORM: FacilityForm = {
  name: '',
  address: '',
  hours: createEmptyFacilityHours(),
  courtCount: '',
  verifiedBy: '',
  hasLights: false,
  hasRestrooms: false,
  hasWater: false,
  latitude: '',
  longitude: '',
  geofenceLatitude: '',
  geofenceLongitude: '',
  radiusM: '',
  isActive: false,
};

const CREATE_VERIFIED_BY_DEFAULT = 'CourtCheck Admin';

function createInitialForm(mode: EditorMode): FacilityForm {
  if (mode !== 'create') {
    return { ...EMPTY_FORM, hours: createEmptyFacilityHours() };
  }

  const latitude = formatCoordinate(LAS_VEGAS_REGION.latitude);
  const longitude = formatCoordinate(LAS_VEGAS_REGION.longitude);

  return {
    ...EMPTY_FORM,
    hours: createEmptyFacilityHours(),
    verifiedBy: CREATE_VERIFIED_BY_DEFAULT,
    latitude,
    longitude,
    geofenceLatitude: latitude,
    geofenceLongitude: longitude,
  };
}

export function AdminFacilityEditorScreen({
  facilityId,
  mode,
}: {
  facilityId?: string;
  mode: EditorMode;
}) {
  const router = useRouter();
  const navigation = useNavigation();
  const safeAreaInsets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const checkInAreaMapRef = useRef<MapView>(null);
  const formScrollRef = useRef<ScrollView>(null);
  const inlineRadiusInputRef = useRef<TextInput>(null);
  const isInlineRadiusFocusedRef = useRef(false);
  const visualGeofenceRadiusRef = useRef<number | null>(null);
  const lastInlineRadiusCameraFit = useRef<number | null>(null);
  const isPublicMapReady = useRef(false);
  const isCheckInAreaMapReady = useRef(false);
  const saveInFlight = useRef(false);
  const publicLocationInFlight = useRef(false);
  const reverseGeocodeSequence = useRef(0);
  const lastPrefilledAddress = useRef<string | null>(null);
  const loadSequence = useRef(0);
  const isMounted = useRef(true);
  const allowNavigation = useRef(false);
  const discardPromptOpen = useRef(false);
  const geofenceEstablished = useRef(mode === 'create');
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [form, setForm] = useState<FacilityForm>(() => createInitialForm(mode));
  const [baseline, setBaseline] = useState(() => serializeForm(createInitialForm(mode)));
  const [canonicalWasActive, setCanonicalWasActive] = useState(false);
  const [loadState, setLoadState] = useState<'error' | 'loading' | 'not-found' | 'ready'>(
    mode === 'edit' ? 'loading' : 'ready',
  );
  const [isSaving, setIsSaving] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [mapEditorMode, setMapEditorMode] = useState<AdminFacilityMapEditorMode | null>(null);
  const [isGettingPublicLocation, setIsGettingPublicLocation] = useState(false);
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);
  const [publicLocationFeedback, setPublicLocationFeedback] = useState<string | null>(null);
  const [isInlineRadiusFocused, setIsInlineRadiusFocused] = useState(false);
  const [lastValidGeofenceRadius, setLastValidGeofenceRadius] = useState<number | null>(null);

  const isMalformedEditId = mode === 'edit' && !isValidFacilityId(facilityId);
  const errors = useMemo(() => validateForm(form), [form]);
  const isDirty = loadState === 'ready' && serializeForm(form) !== baseline;
  const isSaveDisabled = isSaving || (mode === 'edit' && !isDirty);
  const publicCoordinate = getCoordinate(form.latitude, form.longitude);
  const geofenceCoordinate = getCoordinate(form.geofenceLatitude, form.geofenceLongitude);
  const validGeofenceRadius = parseGeofenceRadius(form.radiusM);
  const visualGeofenceRadius = validGeofenceRadius ?? lastValidGeofenceRadius;

  useEffect(() => {
    visualGeofenceRadiusRef.current = visualGeofenceRadius;
  }, [visualGeofenceRadius]);

  useEffect(() => {
    const keyboardEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const showSubscription = Keyboard.addListener(keyboardEvent, () => {
      if (isInlineRadiusFocusedRef.current && inlineRadiusInputRef.current) {
        formScrollRef.current?.scrollResponderScrollNativeHandleToKeyboard(
          inlineRadiusInputRef.current,
          spacing.md,
          true,
        );
      }
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      if (isInlineRadiusFocusedRef.current) {
        isInlineRadiusFocusedRef.current = false;
        inlineRadiusInputRef.current?.blur();
        setIsInlineRadiusFocused(false);
      }
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      reverseGeocodeSequence.current += 1;
      if (feedbackTimer.current) {
        clearTimeout(feedbackTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (mode !== 'edit') {
      return;
    }

    if (isMalformedEditId || !facilityId) {
      const stateTimer = setTimeout(() => setLoadState('not-found'), 0);
      return () => clearTimeout(stateTimer);
    }

    const requestId = ++loadSequence.current;
    const loadTimer = setTimeout(() => {
      setLoadState('loading');
      void getAdminFacility(facilityId)
        .then((facility) => {
          if (!isMounted.current || requestId !== loadSequence.current) {
            return;
          }
          reconcileCanonicalFacility(facility);
          setLoadState('ready');
        })
        .catch((loadError: unknown) => {
          if (!isMounted.current || requestId !== loadSequence.current) {
            return;
          }
          setLoadState(loadError instanceof AdminFacilityNotFoundError ? 'not-found' : 'error');
        });
    }, 0);

    return () => {
      clearTimeout(loadTimer);
      loadSequence.current += 1;
    };
  }, [facilityId, isMalformedEditId, mode]);

  usePreventRemove(isDirty || isSaving, ({ data }) => {
    if (allowNavigation.current) {
      navigation.dispatch(data.action);
      return;
    }

    if (isSaving || discardPromptOpen.current) {
      return;
    }

    discardPromptOpen.current = true;
    const closePrompt = () => {
      discardPromptOpen.current = false;
    };

    Alert.alert(
      'Discard unsaved changes?',
      'Your facility edits have not been saved.',
      [
        { onPress: closePrompt, style: 'cancel', text: 'Stay' },
        {
          onPress: () => {
            closePrompt();
            allowNavigation.current = true;
            navigation.dispatch(data.action);
          },
          style: 'destructive',
          text: 'Discard',
        },
      ],
      { cancelable: true, onDismiss: closePrompt },
    );
  });

  useEffect(() => {
    const coordinate = getCoordinate(form.latitude, form.longitude);
    if (!isPublicMapReady.current || !coordinate) {
      return;
    }

    frameFacilityLocation(mapRef.current, coordinate, true);
  }, [form.latitude, form.longitude]);

  useEffect(() => {
    if (!isCheckInAreaMapReady.current) {
      return;
    }

    frameCheckInArea(
      checkInAreaMapRef.current,
      getCoordinate(form.latitude, form.longitude),
      getCoordinate(form.geofenceLatitude, form.geofenceLongitude),
      visualGeofenceRadiusRef.current,
      true,
    );
    lastInlineRadiusCameraFit.current = visualGeofenceRadiusRef.current;
  }, [
    form.geofenceLatitude,
    form.geofenceLongitude,
    form.latitude,
    form.longitude,
  ]);

  useEffect(() => {
    if (
      !isCheckInAreaMapReady.current ||
      visualGeofenceRadius === null ||
      visualGeofenceRadius === lastInlineRadiusCameraFit.current
    ) {
      return;
    }

    const frameTimer = setTimeout(() => {
      frameCheckInArea(
        checkInAreaMapRef.current,
        getCoordinate(form.latitude, form.longitude),
        getCoordinate(form.geofenceLatitude, form.geofenceLongitude),
        visualGeofenceRadius,
        true,
      );
      lastInlineRadiusCameraFit.current = visualGeofenceRadius;
    }, 400);

    return () => clearTimeout(frameTimer);
  }, [
    form.geofenceLatitude,
    form.geofenceLongitude,
    form.latitude,
    form.longitude,
    visualGeofenceRadius,
  ]);

  function reconcileCanonicalFacility(facility: AdminFacilityDetail) {
    const nextForm = formFromFacility(facility);
    geofenceEstablished.current = facility.geofence !== null;
    setForm(nextForm);
    setLastValidGeofenceRadius(parseGeofenceRadius(nextForm.radiusM));
    setBaseline(serializeForm(nextForm));
    setCanonicalWasActive(facility.isActive);
    setShowValidation(false);
    lastPrefilledAddress.current = null;
  }

  function showFeedback(nextFeedback: Feedback, autoDismiss = false) {
    if (feedbackTimer.current) {
      clearTimeout(feedbackTimer.current);
      feedbackTimer.current = null;
    }
    setFeedback(nextFeedback);
    if (autoDismiss) {
      feedbackTimer.current = setTimeout(() => {
        feedbackTimer.current = null;
        if (isMounted.current) {
          setFeedback(null);
        }
      }, 2800);
    }
  }

  const updateField = <Key extends keyof FacilityForm>(key: Key, value: FacilityForm[Key]) => {
    setFeedback(null);
    setForm((current) => ({ ...current, [key]: value }));
  };

  const updatePublicFields = (latitude: string, longitude: string) => {
    setFeedback(null);
    setForm((current) => {
      const next = { ...current, latitude, longitude };
      const coordinate = getCoordinate(latitude, longitude);
      const geofenceIsUnset =
        current.geofenceLatitude.trim() === '' && current.geofenceLongitude.trim() === '';

      if (
        mode === 'create' &&
        coordinate &&
        geofenceIsUnset &&
        !geofenceEstablished.current
      ) {
        next.geofenceLatitude = formatCoordinate(coordinate.latitude);
        next.geofenceLongitude = formatCoordinate(coordinate.longitude);
        geofenceEstablished.current = true;
      }
      return next;
    });
  };

  const updateGeofenceField = (
    key: 'geofenceLatitude' | 'geofenceLongitude' | 'radiusM',
    value: string,
  ) => {
    geofenceEstablished.current = true;
    updateField(key, value);
  };

  const updateRadiusField = (value: string) => {
    const nextValidRadius = parseGeofenceRadius(value);
    setLastValidGeofenceRadius((current) =>
      nextValidRadius ?? validGeofenceRadius ?? current,
    );
    updateGeofenceField('radiusM', value);
  };

  const prefillAddressFromCoordinate = async (coordinate: LatLng) => {
    if (mode !== 'create') {
      return;
    }

    const requestId = ++reverseGeocodeSequence.current;
    setIsResolvingAddress(true);

    try {
      const address = await reverseGeocodeAdminFacilityAddress(coordinate);
      if (!isMounted.current || requestId !== reverseGeocodeSequence.current || !address) {
        return;
      }

      setForm((current) => {
        const currentAddress = current.address.trim();
        const canPrefill =
          currentAddress.length === 0 || currentAddress === lastPrefilledAddress.current;

        if (!canPrefill) {
          return current;
        }

        lastPrefilledAddress.current = address;
        return { ...current, address };
      });
    } catch {
      // Selecting a location remains fully usable when native reverse geocoding is unavailable.
    } finally {
      if (isMounted.current && requestId === reverseGeocodeSequence.current) {
        setIsResolvingAddress(false);
      }
    }
  };

  const setPublicCoordinate = (coordinate: LatLng) => {
    setPublicLocationFeedback(null);
    updatePublicFields(formatCoordinate(coordinate.latitude), formatCoordinate(coordinate.longitude));
    void prefillAddressFromCoordinate(coordinate);
  };

  const handleUseMyLocation = async () => {
    if (publicLocationInFlight.current) {
      return;
    }

    publicLocationInFlight.current = true;
    setIsGettingPublicLocation(true);
    setPublicLocationFeedback(null);
    try {
      const coordinate = await getAdminCurrentLocation();
      if (isMounted.current) {
        setPublicCoordinate(coordinate);
      }
    } catch {
      if (isMounted.current) {
        setPublicLocationFeedback(
          'Your location is unavailable. You can still place the marker manually.',
        );
      }
    } finally {
      publicLocationInFlight.current = false;
      if (isMounted.current) {
        setIsGettingPublicLocation(false);
      }
    }
  };

  const setGeofenceCoordinate = (coordinate: LatLng) => {
    geofenceEstablished.current = true;
    setFeedback(null);
    setForm((current) => ({
      ...current,
      geofenceLatitude: formatCoordinate(coordinate.latitude),
      geofenceLongitude: formatCoordinate(coordinate.longitude),
    }));
  };

  const usePublicLocation = () => {
    if (!publicCoordinate) {
      showFeedback({ message: 'Enter a valid public latitude and longitude first.', tone: 'error' });
      return;
    }
    setGeofenceCoordinate(publicCoordinate);
  };

  const retryLoad = () => {
    if (!facilityId || isMalformedEditId) {
      return;
    }
    const requestId = ++loadSequence.current;
    setLoadState('loading');
    void getAdminFacility(facilityId)
      .then((facility) => {
        if (!isMounted.current || requestId !== loadSequence.current) {
          return;
        }
        reconcileCanonicalFacility(facility);
        setLoadState('ready');
      })
      .catch((loadError: unknown) => {
        if (!isMounted.current || requestId !== loadSequence.current) {
          return;
        }
        setLoadState(loadError instanceof AdminFacilityNotFoundError ? 'not-found' : 'error');
      });
  };

  const performSave = async () => {
    if (saveInFlight.current) {
      return;
    }

    setShowValidation(true);
    if (Object.keys(errors).length > 0) {
      showFeedback({ message: 'Review the highlighted fields before saving.', tone: 'error' });
      return;
    }

    const input = toSaveInput(form, mode === 'edit' ? facilityId ?? null : null);
    if (!input) {
      showFeedback({ message: 'Review the facility details before saving.', tone: 'error' });
      return;
    }

    saveInFlight.current = true;
    setIsSaving(true);
    setFeedback(null);

    try {
      const savedId = await saveAdminFacility(input);
      const canonical = await getAdminFacility(savedId);
      if (!isMounted.current) {
        return;
      }

      reconcileCanonicalFacility(canonical);

      allowNavigation.current = true;
      router.dismissTo({
        pathname: '/(admin)/admin/facilities',
        params: {
          focusFacilityId: savedId,
          success: mode === 'create' ? 'created' : 'updated',
        },
      });
    } catch (saveError) {
      if (!isMounted.current) {
        return;
      }
      showFeedback({
        message:
          saveError instanceof AdminFacilityNotFoundError
            ? 'This facility is no longer available. Return to Facilities and refresh.'
            : 'Couldn’t save this facility. Check the details and try again.',
        tone: 'error',
      });
    } finally {
      saveInFlight.current = false;
      if (isMounted.current) {
        setIsSaving(false);
      }
    }
  };

  const requestSave = () => {
    if (mode === 'edit' && !isDirty) {
      return;
    }

    if (canonicalWasActive && !form.isActive) {
      Alert.alert(
        'Save as inactive?',
        'This removes the facility from player discovery, closes current check-ins, and ends current facility status reports.',
        [
          { style: 'cancel', text: 'Cancel' },
          { onPress: () => void performSave(), style: 'destructive', text: 'Save as Inactive' },
        ],
      );
      return;
    }
    void performSave();
  };

  const goBack = () => {
    if (isSaving) {
      return;
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(admin)/admin/facilities');
    }
  };

  const scrollInlineRadiusIntoView = () => {
    if (!inlineRadiusInputRef.current) {
      return;
    }

    formScrollRef.current?.scrollResponderScrollNativeHandleToKeyboard(
      inlineRadiusInputRef.current,
      spacing.md,
      true,
    );
  };

  const focusInlineRadius = () => {
    isInlineRadiusFocusedRef.current = true;
    setIsInlineRadiusFocused(true);
    requestAnimationFrame(scrollInlineRadiusIntoView);
  };

  const blurInlineRadius = () => {
    isInlineRadiusFocusedRef.current = false;
    setIsInlineRadiusFocused(false);
  };

  const finishInlineRadiusEditing = () => {
    inlineRadiusInputRef.current?.blur();
    Keyboard.dismiss();
  };

  if (loadState !== 'ready') {
    return (
      <EditorState
        kind={loadState}
        onBack={goBack}
        onRetry={loadState === 'error' ? retryLoad : undefined}
      />
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Back to facilities"
          accessibilityRole="button"
          disabled={isSaving}
          hitSlop={6}
          onPress={goBack}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
          <CourtCheckSymbol android="arrow_back" color={colors.tealDark} ios="chevron.left" size={20} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>Admin</Text>
          <Text accessibilityRole="header" numberOfLines={1} style={styles.headerTitle}>
            {mode === 'create' ? 'Create Facility' : 'Edit Facility'}
          </Text>
        </View>
        <View style={[styles.stateBadge, form.isActive ? styles.activeBadge : styles.inactiveBadge]}>
          <View style={[styles.stateDot, form.isActive ? styles.activeDot : styles.inactiveDot]} />
          <Text style={[styles.stateText, form.isActive ? styles.activeText : styles.inactiveText]}>
            {form.isActive ? 'Active' : 'Inactive'}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            isInlineRadiusFocused && styles.radiusEditingContent,
          ]}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          pointerEvents={isSaving ? 'none' : 'auto'}
          ref={formScrollRef}
          scrollEnabled={!isSaving}
          showsVerticalScrollIndicator={false}>
          {mode === 'edit' ? (
            <View style={styles.intro}>
              <Text style={styles.introTitle}>Facility details</Text>
              <Text style={styles.introBody}>
                Keep player-facing information and the check-in area accurate.
              </Text>
            </View>
          ) : null}

          <FormSection
            icon={{ android: 'map', ios: 'map' }}
            title="1 · Choose Location">
            <Text style={styles.sectionDescription}>
              Shown to players on the map and used for directions.
            </Text>
            <View style={styles.coordinateRow}>
              <View style={styles.coordinateField}>
                <FormField
                  error={showValidation ? errors.latitude : undefined}
                  keyboardType="numbers-and-punctuation"
                  label="Latitude"
                  onChangeText={(value) => updatePublicFields(value, form.longitude)}
                  placeholder="36.1699"
                  value={form.latitude}
                />
              </View>
              <View style={styles.coordinateField}>
                <FormField
                  error={showValidation ? errors.longitude : undefined}
                  keyboardType="numbers-and-punctuation"
                  label="Longitude"
                  onChangeText={(value) => updatePublicFields(form.latitude, value)}
                  placeholder="-115.1398"
                  value={form.longitude}
                />
              </View>
            </View>
            <MapPreviewHeader
              isGettingLocation={isGettingPublicLocation}
              instruction="Tap the map or drag the teal marker to adjust."
              onExpand={() => setMapEditorMode('public')}
              onUseMyLocation={() => void handleUseMyLocation()}
            />
            {publicLocationFeedback ? (
              <Text accessibilityLiveRegion="polite" style={styles.mapActionError}>
                {publicLocationFeedback}
              </Text>
            ) : null}
            {isResolvingAddress ? (
              <View accessibilityLiveRegion="polite" style={styles.addressLookupStatus}>
                <ActivityIndicator color={colors.teal} size="small" />
                <Text style={styles.addressLookupText}>Finding the nearest address…</Text>
              </View>
            ) : null}
            <MapView
              initialRegion={publicCoordinate ? regionAround(publicCoordinate) : LAS_VEGAS_REGION}
              mapType="standard"
              onMapReady={() => {
                isPublicMapReady.current = true;
                frameFacilityLocation(mapRef.current, publicCoordinate, false);
              }}
              onPress={(event) => setPublicCoordinate(event.nativeEvent.coordinate)}
              pitchEnabled={false}
              ref={mapRef}
              rotateEnabled={false}
              showsCompass
              showsMyLocationButton={false}
              showsUserLocation={false}
              style={styles.map}
              toolbarEnabled={false}>
              {publicCoordinate ? (
                <FacilityLocationMarker
                  coordinate={publicCoordinate}
                  editable
                  onChange={setPublicCoordinate}
                />
              ) : null}
            </MapView>
          </FormSection>

          <FormSection
            icon={{ android: 'location_city', ios: 'building.2' }}
            title="2 · Facility Details">
            <FormField
              error={showValidation ? errors.name : undefined}
              label="Facility name"
              onChangeText={(value) => updateField('name', value)}
              placeholder="Sunset Park Pickleball Courts"
              value={form.name}
            />
            <FormField
              error={showValidation ? errors.address : undefined}
              label="Address"
              multiline
              onChangeText={(value) => updateField('address', value)}
              placeholder="2601 E Sunset Rd, Las Vegas, NV"
              value={form.address}
            />
            <FacilityHoursInput
              error={showValidation ? errors.hours : undefined}
              onChange={(value) => updateField('hours', value)}
              value={form.hours}
            />
            <FormField
              error={showValidation ? errors.courtCount : undefined}
              keyboardType="number-pad"
              label="Court count"
              onChangeText={(value) => updateField('courtCount', value)}
              placeholder="0"
              value={form.courtCount}
            />
            <FormField
              label="Verified by (optional)"
              onChangeText={(value) => updateField('verifiedBy', value)}
              placeholder="Organization name"
              value={form.verifiedBy}
            />
            <FormSubsection title="Amenities">
              <ToggleRow
                label="Lights"
                onValueChange={(value) => updateField('hasLights', value)}
                value={form.hasLights}
              />
              <ToggleRow
                label="Restrooms"
                onValueChange={(value) => updateField('hasRestrooms', value)}
                value={form.hasRestrooms}
              />
              <ToggleRow
                isLast
                label="Water"
                onValueChange={(value) => updateField('hasWater', value)}
                value={form.hasWater}
              />
            </FormSubsection>
          </FormSection>

          <FormSection
            icon={{ android: 'my_location', ios: 'scope' }}
            title="3 · Check-in Area">
            <Text style={styles.sectionDescription}>
              Defines where players must be to check in.
            </Text>
            <View style={styles.mapLegend}>
              <LegendItem color={colors.teal} label="Facility Location" />
              <LegendItem color={colors.orange} label="Check-in Area" />
            </View>
            <MapPreviewHeader
              leadingAction={{
                accessibilityLabel: 'Use Facility Location for Check-in Area',
                disabled: !publicCoordinate,
                icon: { android: 'content_copy', ios: 'location.fill' },
                label: 'Use Facility Location',
                onPress: usePublicLocation,
              }}
              instruction="Tap the map or drag the orange marker to adjust the check-in center."
              onExpand={() => {
                finishInlineRadiusEditing();
                setMapEditorMode('geofence');
              }}
            />
            <MapView
              initialRegion={
                geofenceCoordinate
                  ? regionAround(geofenceCoordinate)
                  : publicCoordinate
                    ? regionAround(publicCoordinate)
                    : LAS_VEGAS_REGION
              }
              mapType="standard"
              onMapReady={() => {
                isCheckInAreaMapReady.current = true;
                lastInlineRadiusCameraFit.current = visualGeofenceRadius;
                frameCheckInArea(
                  checkInAreaMapRef.current,
                  publicCoordinate,
                  geofenceCoordinate,
                  visualGeofenceRadius,
                  false,
                );
              }}
              onPress={(event) => {
                finishInlineRadiusEditing();
                setGeofenceCoordinate(event.nativeEvent.coordinate);
              }}
              pitchEnabled={false}
              ref={checkInAreaMapRef}
              rotateEnabled={false}
              showsCompass
              showsMyLocationButton={false}
              showsUserLocation={false}
              style={styles.map}
              toolbarEnabled={false}>
              {geofenceCoordinate && visualGeofenceRadius !== null ? (
                <Circle
                  center={geofenceCoordinate}
                  fillColor="rgba(232, 98, 44, 0.14)"
                  radius={visualGeofenceRadius}
                  strokeColor={colors.orange}
                  strokeWidth={2}
                />
              ) : null}
              <CheckInAreaMarkers
                checkInCoordinate={geofenceCoordinate}
                facilityCoordinate={publicCoordinate}
                onChangeCheckInCoordinate={setGeofenceCoordinate}
              />
            </MapView>
            <View style={styles.inlineRadiusField}>
              <Text style={styles.fieldLabel}>Radius in meters</Text>
              <TextInput
                accessibilityLabel="Check-in Area radius in meters"
                autoCorrect={false}
                keyboardType="number-pad"
                onBlur={blurInlineRadius}
                onChangeText={updateRadiusField}
                onFocus={focusInlineRadius}
                onSubmitEditing={finishInlineRadiusEditing}
                placeholder="10–1000"
                placeholderTextColor="#84929B"
                ref={inlineRadiusInputRef}
                returnKeyType="done"
                style={[styles.input, showValidation && errors.radiusM && styles.invalidInput]}
                value={form.radiusM}
              />
              {showValidation && errors.radiusM ? (
                <Text style={styles.fieldError}>{errors.radiusM}</Text>
              ) : null}
            </View>
            <View style={styles.coordinateRow}>
              <View style={styles.coordinateField}>
                <FormField
                  error={showValidation ? errors.geofenceLatitude : undefined}
                  keyboardType="numbers-and-punctuation"
                  label="Center latitude"
                  onChangeText={(value) => updateGeofenceField('geofenceLatitude', value)}
                  placeholder="36.1699"
                  value={form.geofenceLatitude}
                />
              </View>
              <View style={styles.coordinateField}>
                <FormField
                  error={showValidation ? errors.geofenceLongitude : undefined}
                  keyboardType="numbers-and-punctuation"
                  label="Center longitude"
                  onChangeText={(value) => updateGeofenceField('geofenceLongitude', value)}
                  placeholder="-115.1398"
                  value={form.geofenceLongitude}
                />
              </View>
            </View>
            <FormSubsection title="Availability">
              <ToggleRow
                isLast
                label={form.isActive ? 'Active for players' : 'Inactive'}
                onValueChange={(value) => updateField('isActive', value)}
                supportingText={
                  form.isActive
                    ? 'This facility is visible to players.'
                    : 'This facility is hidden from player discovery.'
                }
                value={form.isActive}
              />
            </FormSubsection>
          </FormSection>

        </ScrollView>

        {!isInlineRadiusFocused ? (
          <View
            style={[
              styles.stickyActionBar,
              { paddingBottom: Math.max(safeAreaInsets.bottom, spacing.md) },
            ]}>
            {feedback ? (
              <View
                accessibilityLiveRegion="polite"
                style={[
                  styles.inlineFeedback,
                  feedback.tone === 'success' ? styles.successFeedback : styles.errorFeedback,
                ]}>
                <CourtCheckSymbol
                  android={feedback.tone === 'success' ? 'check_circle' : 'error'}
                  color={feedback.tone === 'success' ? colors.success : colors.danger}
                  ios={feedback.tone === 'success' ? 'checkmark.circle.fill' : 'exclamationmark.circle.fill'}
                  size={18}
                />
                <Text style={feedback.tone === 'success' ? styles.successText : styles.errorText}>
                  {feedback.message}
                </Text>
              </View>
            ) : null}

            <Pressable
              accessibilityLabel={mode === 'create' ? 'Create Facility' : 'Save Changes'}
              accessibilityRole="button"
              accessibilityState={{ busy: isSaving, disabled: isSaveDisabled }}
              disabled={isSaveDisabled}
              onPress={requestSave}
              style={({ pressed }) => [
                styles.saveButton,
                isSaveDisabled && styles.disabled,
                pressed && styles.pressed,
              ]}>
              {isSaving ? <ActivityIndicator color={colors.white} size="small" /> : null}
              <Text style={styles.saveButtonText}>
                {isSaving ? 'Saving…' : mode === 'create' ? 'Create Facility' : 'Save Changes'}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </KeyboardAvoidingView>
      {mapEditorMode ? (
        <AdminFacilityMapEditor
          geofenceCoordinate={geofenceCoordinate}
          mode={mapEditorMode}
          onChangeGeofenceCoordinate={setGeofenceCoordinate}
          onChangePublicCoordinate={setPublicCoordinate}
          onChangeRadius={updateRadiusField}
          onClose={() => setMapEditorMode(null)}
          onUsePublicLocation={usePublicLocation}
          publicCoordinate={publicCoordinate}
          radius={form.radiusM}
          visible
          visualRadiusM={visualGeofenceRadius}
        />
      ) : null}
    </SafeAreaView>
  );
}

function FormSection({
  children,
  icon,
  title,
}: {
  children: React.ReactNode;
  icon: { android: Parameters<typeof CourtCheckSymbol>[0]['android']; ios: Parameters<typeof CourtCheckSymbol>[0]['ios'] };
  title: string;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIcon}>
          <CourtCheckSymbol android={icon.android} color={colors.teal} ios={icon.ios} size={18} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.sectionFields}>{children}</View>
    </View>
  );
}

function FormSubsection({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <View style={styles.subsection}>
      <Text style={styles.subsectionTitle}>{title}</Text>
      <View style={styles.subsectionFields}>{children}</View>
    </View>
  );
}

function FormField({
  error,
  keyboardType,
  label,
  multiline = false,
  onChangeText,
  placeholder,
  value,
}: {
  error?: string;
  keyboardType?: 'number-pad' | 'numbers-and-punctuation';
  label: string;
  multiline?: boolean;
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        autoCapitalize="sentences"
        autoCorrect={false}
        keyboardType={keyboardType}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#84929B"
        style={[styles.input, multiline && styles.multilineInput, error && styles.invalidInput]}
        value={value}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

function ToggleRow({
  isLast = false,
  label,
  onValueChange,
  supportingText,
  value,
}: {
  isLast?: boolean;
  label: string;
  onValueChange: (value: boolean) => void;
  supportingText?: string;
  value: boolean;
}) {
  return (
    <View style={[styles.toggleRow, isLast && styles.lastToggleRow]}>
      <View style={styles.toggleCopy}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {supportingText ? <Text style={styles.toggleSupporting}>{supportingText}</Text> : null}
      </View>
      <Switch
        accessibilityLabel={label}
        ios_backgroundColor="#A9B8B5"
        onValueChange={onValueChange}
        thumbColor={colors.white}
        trackColor={{ false: '#A9B8B5', true: colors.teal }}
        value={value}
      />
    </View>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

function MapPreviewHeader({
  instruction,
  isGettingLocation = false,
  leadingAction,
  onExpand,
  onUseMyLocation,
}: {
  instruction: string;
  isGettingLocation?: boolean;
  leadingAction?: {
    accessibilityLabel: string;
    disabled?: boolean;
    icon: {
      android: Parameters<typeof CourtCheckSymbol>[0]['android'];
      ios: Parameters<typeof CourtCheckSymbol>[0]['ios'];
    };
    label: string;
    onPress: () => void;
  };
  onExpand: () => void;
  onUseMyLocation?: () => void;
}) {
  return (
    <View style={styles.mapPreviewHeader}>
      <Text style={styles.mapInstruction}>{instruction}</Text>
      <View style={styles.mapPreviewActions}>
        {leadingAction ? (
          <Pressable
            accessibilityLabel={leadingAction.accessibilityLabel}
            accessibilityRole="button"
            accessibilityState={{ disabled: leadingAction.disabled }}
            disabled={leadingAction.disabled}
            onPress={leadingAction.onPress}
            style={({ pressed }) => [
              styles.locationPreviewButton,
              leadingAction.disabled && styles.disabled,
              pressed && styles.pressed,
            ]}>
            <CourtCheckSymbol
              android={leadingAction.icon.android}
              color={colors.tealDark}
              ios={leadingAction.icon.ios}
              size={15}
            />
            <Text style={styles.expandButtonText}>{leadingAction.label}</Text>
          </Pressable>
        ) : null}
        {onUseMyLocation ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ busy: isGettingLocation, disabled: isGettingLocation }}
            disabled={isGettingLocation}
            onPress={onUseMyLocation}
            style={({ pressed }) => [
              styles.locationPreviewButton,
              isGettingLocation && styles.disabled,
              pressed && styles.pressed,
            ]}>
            {isGettingLocation ? (
              <ActivityIndicator color={colors.tealDark} size="small" />
            ) : (
              <CourtCheckSymbol android="my_location" color={colors.tealDark} ios="location.fill" size={15} />
            )}
            <Text style={styles.expandButtonText}>
              {isGettingLocation ? 'Locating…' : 'Use My Location'}
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityLabel="Expand map editor"
          accessibilityRole="button"
          hitSlop={5}
          onPress={onExpand}
          style={({ pressed }) => [styles.expandButton, pressed && styles.pressed]}>
          <CourtCheckSymbol
            android="open_in_full"
            color={colors.tealDark}
            ios="arrow.up.left.and.arrow.down.right"
            size={15}
          />
          <Text style={styles.expandButtonText}>Expand Map</Text>
        </Pressable>
      </View>
    </View>
  );
}

function EditorState({
  kind,
  onBack,
  onRetry,
}: {
  kind: 'error' | 'loading' | 'not-found';
  onBack: () => void;
  onRetry?: () => void;
}) {
  const isLoading = kind === 'loading';
  const title = isLoading
    ? 'Loading facility'
    : kind === 'not-found'
      ? 'Facility unavailable'
      : 'Unable to load facility';
  const body = isLoading
    ? 'Getting the latest facility and check-in area details…'
    : kind === 'not-found'
      ? 'This facility link is invalid or the facility no longer exists.'
      : 'Check your connection and try again.';

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.stateHeader}>
        <Pressable accessibilityLabel="Back to facilities" accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <CourtCheckSymbol android="arrow_back" color={colors.tealDark} ios="chevron.left" size={20} />
        </Pressable>
      </View>
      <View accessibilityLiveRegion="polite" style={styles.centeredState}>
        <View style={styles.largeStateIcon}>
          {isLoading ? (
            <ActivityIndicator color={colors.teal} size="large" />
          ) : (
            <CourtCheckSymbol android="error" color={colors.teal} ios="exclamationmark.circle" size={26} />
          )}
        </View>
        <Text style={styles.stateTitle}>{title}</Text>
        <Text style={styles.stateBody}>{body}</Text>
        {onRetry ? (
          <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retryButton}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        ) : !isLoading ? (
          <Pressable accessibilityRole="button" onPress={onBack} style={styles.retryButton}>
            <Text style={styles.retryText}>Back to Facilities</Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function formFromFacility(facility: AdminFacilityDetail): FacilityForm {
  return {
    name: facility.name,
    address: facility.address,
    hours: parseFacilityHours(facility.hoursText),
    courtCount: String(facility.courtCount),
    verifiedBy: facility.verifiedBy ?? '',
    hasLights: facility.hasLights,
    hasRestrooms: facility.hasRestrooms,
    hasWater: facility.hasWater,
    latitude: formatCoordinate(facility.latitude),
    longitude: formatCoordinate(facility.longitude),
    geofenceLatitude: facility.geofence ? formatCoordinate(facility.geofence.latitude) : '',
    geofenceLongitude: facility.geofence ? formatCoordinate(facility.geofence.longitude) : '',
    radiusM: facility.geofence ? String(facility.geofence.radiusM) : '',
    isActive: facility.isActive,
  };
}

function validateForm(form: FacilityForm): FormErrors {
  const errors: FormErrors = {};
  if (!form.name.trim()) errors.name = 'Facility name is required.';
  if (!form.address.trim()) errors.address = 'Address is required.';
  if (!serializeFacilityHours(form.hours)) {
    errors.hours = form.hours.isOpen24Hours
      ? 'Choose valid facility hours.'
      : 'Choose both an opening and closing time, or select Open 24 hours.';
  }

  const courtCount = parseInteger(form.courtCount);
  if (courtCount === null || courtCount < 0) {
    errors.courtCount = 'Enter a whole number of zero or more.';
  }

  if (!isLatitudeText(form.latitude)) errors.latitude = 'Enter a latitude from -90 to 90.';
  if (!isLongitudeText(form.longitude)) errors.longitude = 'Enter a longitude from -180 to 180.';
  if (!isLatitudeText(form.geofenceLatitude)) {
    errors.geofenceLatitude = 'Enter a latitude from -90 to 90.';
  }
  if (!isLongitudeText(form.geofenceLongitude)) {
    errors.geofenceLongitude = 'Enter a longitude from -180 to 180.';
  }

  const radius = parseInteger(form.radiusM);
  if (radius === null || radius < 10 || radius > 1000) {
    errors.radiusM = 'Enter a whole number from 10 to 1000 meters.';
  }
  return errors;
}

function toSaveInput(form: FacilityForm, facilityId: string | null) {
  const hoursText = serializeFacilityHours(form.hours);
  const latitude = parseFiniteNumber(form.latitude);
  const longitude = parseFiniteNumber(form.longitude);
  const geofenceLatitude = parseFiniteNumber(form.geofenceLatitude);
  const geofenceLongitude = parseFiniteNumber(form.geofenceLongitude);
  const courtCount = parseInteger(form.courtCount);
  const geofenceRadiusM = parseInteger(form.radiusM);

  if (
    latitude === null ||
    longitude === null ||
    !hoursText ||
    geofenceLatitude === null ||
    geofenceLongitude === null ||
    courtCount === null ||
    geofenceRadiusM === null
  ) {
    return null;
  }

  return {
    facilityId,
    name: form.name.trim(),
    address: form.address.trim(),
    latitude,
    longitude,
    hoursText,
    courtCount,
    hasLights: form.hasLights,
    hasRestrooms: form.hasRestrooms,
    hasWater: form.hasWater,
    isActive: form.isActive,
    verifiedBy: form.verifiedBy.trim() || null,
    geofenceLatitude,
    geofenceLongitude,
    geofenceRadiusM,
  };
}

function serializeForm(form: FacilityForm) {
  return JSON.stringify(form);
}

function parseFiniteNumber(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseInteger(value: string) {
  const parsed = parseFiniteNumber(value);
  return parsed !== null && Number.isInteger(parsed) ? parsed : null;
}

function parseGeofenceRadius(value: string) {
  const parsed = parseInteger(value);
  return parsed !== null && parsed >= 10 && parsed <= 1000 ? parsed : null;
}

function isLatitudeText(value: string) {
  const parsed = parseFiniteNumber(value);
  return parsed !== null && parsed >= -90 && parsed <= 90;
}

function isLongitudeText(value: string) {
  const parsed = parseFiniteNumber(value);
  return parsed !== null && parsed >= -180 && parsed <= 180;
}

function getCoordinate(latitudeText: string, longitudeText: string): LatLng | null {
  if (!isLatitudeText(latitudeText) || !isLongitudeText(longitudeText)) {
    return null;
  }
  return { latitude: Number(latitudeText), longitude: Number(longitudeText) };
}

function formatCoordinate(value: number) {
  return String(Number(value.toFixed(7)));
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.cloud },
  header: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.card,
  },
  stateHeader: { paddingHorizontal: spacing.xl, paddingVertical: spacing.sm },
  backButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    backgroundColor: colors.card,
  },
  headerCopy: { minWidth: 0, flex: 1 },
  eyebrow: { color: colors.teal, fontSize: typeScale.eyebrow, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase' },
  headerTitle: { marginTop: 2, color: colors.ink, fontSize: 20, fontWeight: '900' },
  stateBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 6, borderRadius: radii.pill },
  activeBadge: { backgroundColor: colors.tealTint },
  inactiveBadge: { backgroundColor: '#EEF1F1' },
  stateDot: { width: 7, height: 7, borderRadius: 4 },
  activeDot: { backgroundColor: colors.teal },
  inactiveDot: { backgroundColor: '#829099' },
  stateText: { fontSize: 11.5, fontWeight: '900' },
  activeText: { color: colors.tealDark },
  inactiveText: { color: colors.inkMuted },
  content: { padding: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.lg },
  radiusEditingContent: { paddingBottom: spacing.xs },
  intro: { paddingHorizontal: 2 },
  introTitle: { color: colors.ink, fontSize: typeScale.title, fontWeight: '900' },
  introBody: { marginTop: 5, color: colors.inkMuted, fontSize: typeScale.bodySmall, lineHeight: 20 },
  section: { padding: spacing.lg, borderWidth: 1, borderColor: colors.line, borderRadius: radii.xl, backgroundColor: colors.card, ...shadows.card },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: colors.tealTint },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  sectionFields: { marginTop: spacing.lg, gap: 14 },
  subsection: {
    marginTop: spacing.xs,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  subsectionTitle: { color: colors.ink, fontSize: 14, fontWeight: '900' },
  subsectionFields: { marginTop: spacing.md, gap: 12 },
  sectionDescription: { marginTop: -2, color: colors.inkMuted, fontSize: 13, lineHeight: 19 },
  field: { gap: 6 },
  fieldLabel: { color: colors.ink, fontSize: 12.5, fontWeight: '800' },
  input: { minHeight: controlHeights.default, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, backgroundColor: '#FAFCFB', color: colors.ink, fontSize: 15 },
  multilineInput: { minHeight: 72, textAlignVertical: 'top' },
  invalidInput: { borderColor: colors.danger, backgroundColor: '#FFF9F9' },
  fieldError: { color: colors.danger, fontSize: 12, lineHeight: 17 },
  coordinateRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  coordinateField: { minWidth: 0, flex: 1 },
  mapPreviewHeader: { gap: spacing.sm },
  mapInstruction: { color: colors.inkMuted, fontSize: 12, lineHeight: 17 },
  mapPreviewActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  expandButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, backgroundColor: colors.cloud },
  locationPreviewButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, borderWidth: 1, borderColor: colors.teal, borderRadius: radii.md, backgroundColor: colors.tealTint },
  expandButtonText: { color: colors.tealDark, fontSize: 12, fontWeight: '900' },
  mapActionError: { color: colors.danger, fontSize: 12, lineHeight: 17 },
  addressLookupStatus: { minHeight: 22, flexDirection: 'row', alignItems: 'center', gap: 8 },
  addressLookupText: { color: colors.inkMuted, fontSize: 12, fontWeight: '700' },
  map: { height: 245, overflow: 'hidden', borderRadius: radii.lg },
  inlineRadiusField: { gap: 6 },
  toggleRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  lastToggleRow: { paddingBottom: 0, borderBottomWidth: 0 },
  toggleCopy: { minWidth: 0, flex: 1 },
  toggleLabel: { color: colors.ink, fontSize: 14.5, fontWeight: '800' },
  toggleSupporting: { marginTop: 3, color: colors.inkMuted, fontSize: 12.5, lineHeight: 18 },
  mapLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendText: { color: colors.inkMuted, fontSize: 12 },
  inlineFeedback: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 14, borderWidth: 1, borderRadius: radii.md },
  successFeedback: { borderColor: '#B9D9CB', backgroundColor: '#EDF8F2' },
  errorFeedback: { borderColor: '#F0D1D1', backgroundColor: '#FFF4F4' },
  successText: { minWidth: 0, flex: 1, color: colors.success, fontSize: 13, fontWeight: '800' },
  errorText: { minWidth: 0, flex: 1, color: colors.danger, fontSize: 13, fontWeight: '800', lineHeight: 18 },
  stickyActionBar: {
    gap: spacing.sm,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.card,
  },
  saveButton: { minHeight: controlHeights.default, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderRadius: radii.lg, backgroundColor: colors.teal, ...shadows.button },
  saveButtonText: { color: colors.white, fontSize: typeScale.button, fontWeight: '900' },
  centeredState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  largeStateIcon: { width: 62, height: 62, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: colors.tealTint },
  stateTitle: { marginTop: 16, color: colors.ink, fontSize: 20, fontWeight: '900', textAlign: 'center' },
  stateBody: { maxWidth: 310, marginTop: 7, color: colors.inkMuted, fontSize: 13.5, lineHeight: 20, textAlign: 'center' },
  retryButton: { minHeight: 46, justifyContent: 'center', marginTop: spacing.lg, paddingHorizontal: spacing.xl, borderRadius: radii.md, backgroundColor: colors.teal },
  retryText: { color: colors.white, fontSize: 13.5, fontWeight: '900' },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.48 },
});
