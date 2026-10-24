package com.employee.backend;

import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AttendanceHolidayRepository
        extends JpaRepository<AttendanceHoliday, Long> {

    List<AttendanceHoliday> findAllByDateBetweenOrderByDateAsc(
            LocalDate from, LocalDate through);

    boolean existsByDate(LocalDate date);
}
