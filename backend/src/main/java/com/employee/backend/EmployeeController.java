
package com.employee.backend;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.transaction.annotation.Transactional;

import jakarta.validation.Valid;

@CrossOrigin(origins = {
    "http://localhost:5173",
    "http://localhost:5174"
})
@RestController
@RequestMapping("/api/employees")
public class EmployeeController {

    private final EmployeeRepository employeeRepository;
    private final UserAccountRepository userRepository;
    private final ActivityService activityService;

    public EmployeeController(
            EmployeeRepository employeeRepository,
            UserAccountRepository userRepository,
            ActivityService activityService) {
        this.employeeRepository = employeeRepository;
        this.userRepository = userRepository;
        this.activityService = activityService;
    }

    // GET: Retrieve all employees
    @GetMapping
    public List<Employee> getAllEmployees() {
        return employeeRepository.findAll();
    }

    // GET: Retrieve one employee by ID
    @GetMapping("/{id}")
    public ResponseEntity<Employee> getEmployeeById(
            @PathVariable String id) {

        return employeeRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    // POST: Add a new employee
    @PostMapping
    @Transactional
    public ResponseEntity<Employee> addEmployee(
            @Valid @RequestBody Employee employee,
            @RequestHeader(
                    value = "Authorization",
                    required = false) String authorization) {
        UserAccount actor = requireHrOrAdmin(authorization);

        if (employeeRepository.existsById(employee.getId())) {
            return ResponseEntity.status(HttpStatus.CONFLICT).build();
        }

        Employee savedEmployee = employeeRepository.save(employee);
        activityService.record(
                actor, "EMPLOYEE_ADDED", "Added employee " + savedEmployee.getName());

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(savedEmployee);
    }

    // PUT: Update an existing employee
    @PutMapping("/{id}")
    @Transactional
    public ResponseEntity<Employee> updateEmployee(
            @PathVariable String id,
            @Valid @RequestBody Employee updatedEmployee,
            @RequestHeader(
                    value = "Authorization",
                    required = false) String authorization) {
        UserAccount actor = requireHrOrAdmin(authorization);

        return employeeRepository.findById(id)
                .map(existingEmployee -> {
                    existingEmployee.setName(updatedEmployee.getName());
                    existingEmployee.setDepartment(
                            updatedEmployee.getDepartment());
                    existingEmployee.setRole(updatedEmployee.getRole());
                    existingEmployee.setSalary(updatedEmployee.getSalary());

                    Employee savedEmployee =
                            employeeRepository.save(existingEmployee);
                    activityService.record(
                            actor,
                            "EMPLOYEE_UPDATED",
                            "Updated employee " + savedEmployee.getName());

                    return ResponseEntity.ok(savedEmployee);
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    // DELETE: Remove an employee
    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<Void> deleteEmployee(
            @PathVariable String id,
            @RequestHeader(
                    value = "Authorization",
                    required = false) String authorization) {
        UserAccount actor = requireHrOrAdmin(authorization);

        var employee = employeeRepository.findById(id);
        if (employee.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        userRepository.findByEmployeeId(id).ifPresent(account -> {
            account.setEmployeeId(null);
            userRepository.save(account);
        });
        employeeRepository.deleteById(id);
        activityService.record(
                actor, "EMPLOYEE_REMOVED", "Removed employee " + employee.get().getName());

        return ResponseEntity.noContent().build();
    }

    private UserAccount requireHrOrAdmin(String authorization) {
        UserAccount actor = activityService.requireActor(authorization);
        if (!"ADMIN".equalsIgnoreCase(actor.getRole())
                && !"HR_MANAGER".equalsIgnoreCase(actor.getRole())) {
            throw new org.springframework.web.server.ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Only HR and Admin users can manage employees.");
        }
        return actor;
    }
}
