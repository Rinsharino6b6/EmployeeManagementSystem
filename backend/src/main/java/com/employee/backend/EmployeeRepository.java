
package com.employee.backend;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface EmployeeRepository
        extends JpaRepository<Employee, String> {

    List<Employee> findAllByDepartmentIgnoreCase(String department);
}
