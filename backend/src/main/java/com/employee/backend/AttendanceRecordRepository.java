package com.employee.backend;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AttendanceRecordRepository
        extends JpaRepository<AttendanceRecord, Long> {

    Optional<AttendanceRecord> findByUser_IdAndWorkDate(
            Long userId,
            LocalDate workDate);

    List<AttendanceRecord> findAllByUser_IdOrderByWorkDateDescClockInDesc(
            Long userId);

    List<AttendanceRecord> findAllByWorkDateBetweenOrderByWorkDateDescClockInDesc(
            LocalDate fromDate,
            LocalDate throughDate);

    List<AttendanceRecord> findAllByUser_IdAndWorkDateBetweenOrderByWorkDateDescClockInDesc(
            Long userId,
            LocalDate fromDate,
            LocalDate throughDate);

    List<AttendanceRecord> findAllByOrderByWorkDateDescClockInDesc();
}
