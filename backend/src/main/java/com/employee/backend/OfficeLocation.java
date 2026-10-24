package com.employee.backend;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalTime;

@Entity
@Table(name = "office_locations")
public class OfficeLocation {

    @Id
    private Long id;

    @Column(nullable = false, length = 100)
    private String officeName;

    @Column(nullable = false, length = 300)
    private String address;

    @Column(nullable = false)
    private double latitude;

    @Column(nullable = false)
    private double longitude;

    @Column(nullable = false)
    private double radiusMeters;

    @Column(length = 50)
    private String timeZone = "Asia/Kolkata";

    private LocalTime shiftStart = LocalTime.of(9, 30);

    private LocalTime shiftEnd = LocalTime.of(17, 0);

    private Integer graceMinutes = 15;

    @Column(length = 80)
    private String workDays = "MONDAY,TUESDAY,WEDNESDAY,THURSDAY,FRIDAY";

    protected OfficeLocation() {}

    public OfficeLocation(
            String officeName,
            String address,
            double latitude,
            double longitude,
            double radiusMeters) {
        this(
                officeName,
                address,
                latitude,
                longitude,
                radiusMeters,
                "Asia/Kolkata",
                LocalTime.of(9, 30),
                LocalTime.of(17, 0),
                15,
                "MONDAY,TUESDAY,WEDNESDAY,THURSDAY,FRIDAY");
    }

    public OfficeLocation(
            String officeName,
            String address,
            double latitude,
            double longitude,
            double radiusMeters,
            String timeZone,
            LocalTime shiftStart,
            LocalTime shiftEnd,
            int graceMinutes,
            String workDays) {
        this.id = 1L;
        this.officeName = officeName;
        this.address = address;
        this.latitude = latitude;
        this.longitude = longitude;
        this.radiusMeters = radiusMeters;
        this.timeZone = timeZone;
        this.shiftStart = shiftStart;
        this.shiftEnd = shiftEnd;
        this.graceMinutes = graceMinutes;
        this.workDays = workDays;
    }

    public Long getId() {
        return id;
    }

    public String getOfficeName() {
        return officeName;
    }

    public String getAddress() {
        return address;
    }

    public double getLatitude() {
        return latitude;
    }

    public double getLongitude() {
        return longitude;
    }

    public double getRadiusMeters() {
        return radiusMeters;
    }

    public String getTimeZone() {
        return timeZone == null ? "Asia/Kolkata" : timeZone;
    }

    public LocalTime getShiftStart() {
        return shiftStart == null ? LocalTime.of(9, 30) : shiftStart;
    }

    public LocalTime getShiftEnd() {
        return shiftEnd == null ? LocalTime.of(17, 0) : shiftEnd;
    }

    public int getGraceMinutes() {
        return graceMinutes == null ? 15 : graceMinutes;
    }

    public String getWorkDays() {
        return workDays == null
                ? "MONDAY,TUESDAY,WEDNESDAY,THURSDAY,FRIDAY"
                : workDays;
    }

    public void update(
            String officeName,
            String address,
            double latitude,
            double longitude,
            double radiusMeters,
            String timeZone,
            LocalTime shiftStart,
            LocalTime shiftEnd,
            int graceMinutes,
            String workDays) {
        this.officeName = officeName;
        this.address = address;
        this.latitude = latitude;
        this.longitude = longitude;
        this.radiusMeters = radiusMeters;
        this.timeZone = timeZone;
        this.shiftStart = shiftStart;
        this.shiftEnd = shiftEnd;
        this.graceMinutes = graceMinutes;
        this.workDays = workDays;
    }
}
