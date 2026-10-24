package com.employee.backend;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.DateTimeException;
import java.util.List;
import java.util.Set;
import java.util.Locale;
import java.util.stream.Collectors;

@Component
public class OfficeGeofence {

    private static final double EARTH_RADIUS_METERS = 6_371_000;
    private static final double MAX_DEVICE_ACCURACY_METERS = 100;
    private static final long OFFICE_LOCATION_ID = 1L;

    private final OfficeLocationRepository officeLocationRepository;
    private final String defaultLatitude;
    private final String defaultLongitude;
    private final double defaultRadiusMeters;

    public OfficeGeofence(
            OfficeLocationRepository officeLocationRepository,
            @Value("${app.attendance.office.latitude:}") String defaultLatitude,
            @Value("${app.attendance.office.longitude:}") String defaultLongitude,
            @Value("${app.attendance.office.radius-meters:150}") double defaultRadiusMeters) {
        this.officeLocationRepository = officeLocationRepository;
        this.defaultLatitude = defaultLatitude;
        this.defaultLongitude = defaultLongitude;
        this.defaultRadiusMeters = defaultRadiusMeters;
    }

    @Transactional(readOnly = true)
    public OfficeLocationResponse getOfficeLocation() {
        return officeLocationRepository.findById(OFFICE_LOCATION_ID)
                .map(this::toResponse)
                .orElseGet(this::defaultLocation);
    }

    @Transactional
    public OfficeLocationResponse saveOfficeLocation(OfficeLocationRequest request) {
        if (request == null
                || request.officeName() == null || request.officeName().isBlank()
                || request.officeName().trim().length() > 100
                || request.address() == null || request.address().isBlank()
                || request.address().trim().length() > 300) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Enter an office name and address (maximum 100 and 300 characters).");
        }
        validateCoordinates(request.latitude(), request.longitude(), request.radiusMeters());
        String timeZone = request.timeZone() == null || request.timeZone().isBlank()
                ? "Asia/Kolkata" : request.timeZone().trim();
        try {
            ZoneId.of(timeZone);
        } catch (DateTimeException exception) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Enter a valid IANA time zone.");
        }
        LocalTime shiftStart = request.shiftStart() == null
                ? LocalTime.of(9, 30) : request.shiftStart();
        LocalTime shiftEnd = request.shiftEnd() == null
                ? LocalTime.of(17, 0) : request.shiftEnd();
        int graceMinutes = request.graceMinutes() == null
                ? 15 : request.graceMinutes();
        Set<String> workDays = request.workDays() == null
                ? Set.of("MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY")
                : request.workDays().stream()
                        .map(day -> day == null ? "" : day.trim().toUpperCase(Locale.ROOT))
                        .collect(Collectors.toSet());
        try {
            workDays.forEach(java.time.DayOfWeek::valueOf);
        } catch (IllegalArgumentException exception) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Choose valid working days.");
        }
        if (workDays.isEmpty() || !shiftStart.isBefore(shiftEnd)
                || graceMinutes < 0 || graceMinutes > 120) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Choose valid shift hours, at least one workday, and grace time from 0 to 120 minutes.");
        }
        String normalizedWorkDays = workDays.stream().sorted()
                .collect(Collectors.joining(","));

        OfficeLocation location = officeLocationRepository.findById(OFFICE_LOCATION_ID)
                .orElseGet(() -> new OfficeLocation(
                        request.officeName().trim(),
                        request.address().trim(),
                        request.latitude(),
                        request.longitude(),
                        request.radiusMeters(),
                        timeZone,
                        shiftStart,
                        shiftEnd,
                        graceMinutes,
                        normalizedWorkDays));
        location.update(
                request.officeName().trim(),
                request.address().trim(),
                request.latitude(),
                request.longitude(),
                request.radiusMeters(),
                timeZone,
                shiftStart,
                shiftEnd,
                graceMinutes,
                normalizedWorkDays);
        return toResponse(officeLocationRepository.save(location));
    }

    public LocationVerification validate(Double latitude, Double longitude) {
        return validate(latitude, longitude, null);
    }

    public LocationVerification validate(
            Double latitude,
            Double longitude,
            Double accuracyMeters) {
        validateCoordinates(latitude, longitude, 1.0);
        if (accuracyMeters == null || !Double.isFinite(accuracyMeters)
                || accuracyMeters <= 0
                || accuracyMeters > MAX_DEVICE_ACCURACY_METERS) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Your location reading must be accurate to within 100 m. Enable precise location and try again.");
        }

        OfficeLocationResponse location = getOfficeLocation();
        if (!location.configured()) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Office attendance location is not configured. Contact HR or Admin.");
        }

        double distance = distanceInMeters(
                latitude, longitude, location.latitude(), location.longitude());
        if (distance + accuracyMeters > location.radiusMeters()) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Your location cannot be confidently verified inside the office boundary. Move closer to the office or improve GPS accuracy.");
        }
        return new LocationVerification(distance, accuracyMeters);
    }

    private void validateCoordinates(
            Double latitude,
            Double longitude,
            Double radiusMeters) {
        if (latitude == null || longitude == null
                || !Double.isFinite(latitude) || !Double.isFinite(longitude)
                || latitude < -90 || latitude > 90
                || longitude < -180 || longitude > 180) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Enter valid office and device coordinates.");
        }
        if (radiusMeters == null || !Double.isFinite(radiusMeters)
                || radiusMeters <= 0 || radiusMeters > 5_000) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Choose an office radius greater than 0 and no more than 5,000 meters.");
        }
    }

    private OfficeLocationResponse defaultLocation() {
        Double latitude = parseCoordinate(defaultLatitude);
        Double longitude = parseCoordinate(defaultLongitude);
        boolean configured = latitude != null && longitude != null
                && latitude >= -90 && latitude <= 90
                && longitude >= -180 && longitude <= 180
                && Double.isFinite(defaultRadiusMeters)
                && defaultRadiusMeters > 0 && defaultRadiusMeters <= 5_000;
        return new OfficeLocationResponse(
                "BeetaLogic Office",
                "No. 1059-1063, 2nd Floor, PN Palayam, Lakshmi Mills Jn, Coimbatore - 641037",
                latitude,
                longitude,
                defaultRadiusMeters,
                configured,
                "Asia/Kolkata",
                LocalTime.of(9, 30),
                LocalTime.of(17, 0),
                15,
                "MONDAY,TUESDAY,WEDNESDAY,THURSDAY,FRIDAY");
    }

    private Double parseCoordinate(String value) {
        try {
            return Double.parseDouble(value);
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private OfficeLocationResponse toResponse(OfficeLocation location) {
        return new OfficeLocationResponse(
                location.getOfficeName(),
                location.getAddress(),
                location.getLatitude(),
                location.getLongitude(),
                location.getRadiusMeters(),
                true,
                location.getTimeZone(),
                location.getShiftStart(),
                location.getShiftEnd(),
                location.getGraceMinutes(),
                location.getWorkDays());
    }

    private double distanceInMeters(
            double latitudeOne,
            double longitudeOne,
            double latitudeTwo,
            double longitudeTwo) {
        double latitudeDifference = Math.toRadians(latitudeTwo - latitudeOne);
        double longitudeDifference = Math.toRadians(longitudeTwo - longitudeOne);
        double haversine = Math.pow(Math.sin(latitudeDifference / 2), 2)
                + Math.cos(Math.toRadians(latitudeOne))
                * Math.cos(Math.toRadians(latitudeTwo))
                * Math.pow(Math.sin(longitudeDifference / 2), 2);
        return 2 * EARTH_RADIUS_METERS
                * Math.asin(Math.sqrt(Math.min(1, haversine)));
    }

    public record OfficeLocationRequest(
            String officeName,
            String address,
            Double latitude,
            Double longitude,
            Double radiusMeters,
            String timeZone,
            LocalTime shiftStart,
            LocalTime shiftEnd,
            Integer graceMinutes,
            java.util.List<String> workDays) {
        public OfficeLocationRequest(
                String officeName,
                String address,
                Double latitude,
                Double longitude,
                Double radiusMeters) {
            this(
                    officeName, address, latitude, longitude, radiusMeters,
                    "Asia/Kolkata", LocalTime.of(9, 30), LocalTime.of(17, 0),
                    15, List.of("MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"));
        }
    }

    public record OfficeLocationResponse(
            String officeName,
            String address,
            Double latitude,
            Double longitude,
            double radiusMeters,
            boolean configured,
            String timeZone,
            LocalTime shiftStart,
            LocalTime shiftEnd,
            int graceMinutes,
            String workDays) {}

    public record LocationVerification(
            double distanceMeters,
            double accuracyMeters) {}
}
