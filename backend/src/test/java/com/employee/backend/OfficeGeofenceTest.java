package com.employee.backend;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.time.LocalTime;
import java.util.List;

class OfficeGeofenceTest {

    private OfficeLocationRepository officeLocationRepository;
    private OfficeGeofence geofence;

    @BeforeEach
    void setUp() {
        officeLocationRepository = mock(OfficeLocationRepository.class);
        geofence = new OfficeGeofence(officeLocationRepository, "", "", 150);
    }

    @Test
    void allowsLocationWithinConfiguredOfficeRadius() {
        configureOfficeLocation();

        assertDoesNotThrow(() -> geofence.validate(12.0005, 77.0, 10.0));
    }

    @Test
    void rejectsLocationOutsideConfiguredOfficeRadius() {
        configureOfficeLocation();

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> geofence.validate(12.01, 77.0, 10.0));

        assertEquals(HttpStatus.FORBIDDEN, exception.getStatusCode());
    }

    @Test
    void returnsDefaultAddressButDoesNotClaimItIsConfigured() {
        when(officeLocationRepository.findById(1L)).thenReturn(Optional.empty());

        OfficeGeofence.OfficeLocationResponse location =
                geofence.getOfficeLocation();

        assertEquals("BeetaLogic Office", location.officeName());
        assertEquals(false, location.configured());
        assertEquals(150, location.radiusMeters());
    }

    @Test
    void rejectsAttendanceWhenOfficeLocationIsNotConfigured() {
        when(officeLocationRepository.findById(1L)).thenReturn(Optional.empty());

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> geofence.validate(12.0, 77.0, 10.0));

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, exception.getStatusCode());
    }

    @Test
    void rejectsInvalidDeviceCoordinates() {
        configureOfficeLocation();

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> geofence.validate(91.0, 77.0, 10.0));

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
    }

    @Test
    void rejectsInaccurateDeviceLocation() {
        when(officeLocationRepository.findById(1L)).thenReturn(
                Optional.of(new OfficeLocation(
                        "BeetaLogic", "Coimbatore", 12.0, 77.0, 150)));

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> geofence.validate(12.0, 77.0, 101.0));

        assertEquals(HttpStatus.FORBIDDEN, exception.getStatusCode());
    }

    @Test
    void rejectsLocationWhoseUncertaintyExtendsOutsideTheOfficeRadius() {
        configureOfficeLocation();

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> geofence.validate(12.001, 77.0, 50.0));

        assertEquals(HttpStatus.FORBIDDEN, exception.getStatusCode());
    }

    @Test
    void rejectsMissingOrZeroAccuracyInsteadOfTreatingItAsPrecise() {
        configureOfficeLocation();

        assertEquals(
                HttpStatus.FORBIDDEN,
                assertThrows(
                        ResponseStatusException.class,
                        () -> geofence.validate(12.0, 77.0, null))
                        .getStatusCode());
        assertEquals(
                HttpStatus.FORBIDDEN,
                assertThrows(
                        ResponseStatusException.class,
                        () -> geofence.validate(12.0, 77.0, 0.0))
                        .getStatusCode());
    }

    @Test
    void savesValidatedOfficeCoordinates() {
        when(officeLocationRepository.findById(1L)).thenReturn(Optional.empty());
        when(officeLocationRepository.save(any(OfficeLocation.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        OfficeGeofence.OfficeLocationResponse saved =
                geofence.saveOfficeLocation(new OfficeGeofence.OfficeLocationRequest(
                        "BeetaLogic Office",
                        "Coimbatore",
                        11.0129,
                        76.9861,
                        150.0));

        assertEquals(true, saved.configured());
        assertEquals(11.0129, saved.latitude());
        assertEquals(76.9861, saved.longitude());
    }

    @Test
    void rejectsAnOfficeRadiusAboveFiveKilometers() {
        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> geofence.saveOfficeLocation(
                        new OfficeGeofence.OfficeLocationRequest(
                                "BeetaLogic Office",
                                "Coimbatore",
                                11.0129,
                                76.9861,
                                5_001.0)));

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
    }

    @Test
    void savesTheConfiguredShiftAndOfficeTimezone() {
        when(officeLocationRepository.findById(1L)).thenReturn(Optional.empty());
        when(officeLocationRepository.save(any(OfficeLocation.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        OfficeGeofence.OfficeLocationResponse saved =
                geofence.saveOfficeLocation(new OfficeGeofence.OfficeLocationRequest(
                        "BeetaLogic",
                        "Coimbatore",
                        11.0129,
                        76.9861,
                        150.0,
                        "Asia/Kolkata",
                        LocalTime.of(9, 0),
                        LocalTime.of(17, 30),
                        10,
                        List.of("MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY")));

        assertEquals("Asia/Kolkata", saved.timeZone());
        assertEquals(LocalTime.of(9, 0), saved.shiftStart());
        assertEquals(LocalTime.of(17, 30), saved.shiftEnd());
        assertEquals(10, saved.graceMinutes());
    }

    @Test
    void rejectsAnInvalidShiftSchedule() {
        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> geofence.saveOfficeLocation(
                        new OfficeGeofence.OfficeLocationRequest(
                                "BeetaLogic",
                                "Coimbatore",
                                11.0129,
                                76.9861,
                                150.0,
                                "Asia/Kolkata",
                                LocalTime.of(17, 0),
                                LocalTime.of(9, 0),
                                15,
                                List.of("MONDAY"))));

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
    }

    private void configureOfficeLocation() {
        when(officeLocationRepository.findById(1L)).thenReturn(
                Optional.of(new OfficeLocation(
                        "BeetaLogic Office", "Coimbatore", 12.0, 77.0, 150)));
    }
}
