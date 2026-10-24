package com.employee.backend;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Locale;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@CrossOrigin(origins = {
    "http://localhost:5173",
    "http://localhost:5174"
})
@RestController
@RequestMapping("/api/departments")
public class DepartmentController {

    private final DepartmentRepository departmentRepository;
    private final EmployeeRepository employeeRepository;
    private final UserAccountRepository userRepository;
    private final ActivityService activityService;

    public DepartmentController(
            DepartmentRepository departmentRepository,
            EmployeeRepository employeeRepository,
            UserAccountRepository userRepository,
            ActivityService activityService) {
        this.departmentRepository = departmentRepository;
        this.employeeRepository = employeeRepository;
        this.userRepository = userRepository;
        this.activityService = activityService;
    }

    @GetMapping
    @Transactional
    public List<String> getDepartments() {
        Map<String, String> names = new LinkedHashMap<>();
        departmentRepository.findAll().forEach(department ->
                names.putIfAbsent(key(department.getName()), department.getName()));
        employeeRepository.findAll().forEach(employee ->
                names.putIfAbsent(key(employee.getDepartment()), employee.getDepartment()));
        userRepository.findAll().forEach(user -> {
            if (user.getDepartment() != null && !user.getDepartment().isBlank()) {
                String name = user.getDepartment().trim();
                names.putIfAbsent(key(name), name);
            }
        });
        names.values().forEach(name -> {
            if (!departmentRepository.existsByNameIgnoreCase(name)) {
                departmentRepository.save(new Department(name));
            }
        });
        return names.values().stream().sorted(String.CASE_INSENSITIVE_ORDER).toList();
    }

    @PostMapping
    @Transactional
    public ResponseEntity<List<String>> addDepartment(
            @RequestBody DepartmentRequest request,
            @RequestHeader(value = "Authorization", required = false)
                    String authorization) {
        UserAccount actor = requireHrOrAdmin(authorization);
        if (request == null || request.name() == null
                || request.name().isBlank() || request.name().trim().length() > 100) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Enter a department name up to 100 characters.");
        }
        String name = request.name().trim();
        if (departmentRepository.existsByNameIgnoreCase(name)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "That department already exists.");
        }
        departmentRepository.save(new Department(name));
        activityService.record(actor, "DEPARTMENT_ADDED", "Added department " + name);
        return ResponseEntity.status(HttpStatus.CREATED).body(getDepartments());
    }

    @DeleteMapping("/{department}")
    @Transactional
    public DepartmentDeletion removeDepartment(
            @PathVariable String department,
            @RequestBody(required = false) DepartmentRemovalRequest request,
            @RequestHeader(value = "Authorization", required = false)
                    String authorization) {
        UserAccount actor = requireHrOrAdmin(authorization);
        String name = department.trim();
        Department savedDepartment = departmentRepository.findByNameIgnoreCase(name)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Department was not found."));

        List<Employee> employees =
                employeeRepository.findAllByDepartmentIgnoreCase(name);
        List<UserAccount> accounts = new ArrayList<>(
                userRepository.findAllByDepartmentIgnoreCase(name));
        List<UserAccount> linkedAccounts = employees.isEmpty()
                ? List.of()
                : userRepository.findAllByEmployeeIdIn(
                        employees.stream().map(Employee::getId).toList());
        linkedAccounts.forEach(account -> {
            if (accounts.stream().noneMatch(existing ->
                    existing.getId().equals(account.getId()))) {
                accounts.add(account);
            }
        });

        String moveTo = request == null ? null : normalize(request.moveTo());
        if (!employees.isEmpty() || !accounts.isEmpty()) {
            if (moveTo == null || moveTo.equalsIgnoreCase(name)) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Choose another department for the employees.");
            }
            if (!departmentRepository.existsByNameIgnoreCase(moveTo)) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Employees can only be moved into an existing department.");
            }
        } else if (moveTo != null && moveTo.equalsIgnoreCase(name)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Choose a different department.");
        }

        List<String> employeeIds = employees.stream()
                .map(Employee::getId).toList();
        List<AccountDepartment> accountDepartments = accounts.stream()
                .map(account -> new AccountDepartment(
                        account.getId(), account.getDepartment()))
                .toList();

        if (moveTo != null) {
            employees.forEach(employee -> employee.setDepartment(moveTo));
            employeeRepository.saveAll(employees);
            accounts.forEach(account -> account.setDepartment(moveTo));
            userRepository.saveAll(accounts);
        }
        departmentRepository.delete(savedDepartment);
        activityService.record(
                actor, "DEPARTMENT_REMOVED",
                "Removed department " + name
                        + (moveTo == null ? "" : " and moved employees to " + moveTo));
        return new DepartmentDeletion(name, moveTo, employeeIds, accountDepartments);
    }

    @PostMapping("/undo-removal")
    @Transactional
    public ResponseEntity<Void> undoRemoval(
            @RequestBody DepartmentDeletion deletion,
            @RequestHeader(value = "Authorization", required = false)
                    String authorization) {
        UserAccount actor = requireHrOrAdmin(authorization);
        if (deletion == null || deletion.name() == null
                || deletion.name().isBlank() || deletion.name().trim().length() > 100
                || departmentRepository.existsByNameIgnoreCase(deletion.name().trim())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "The department cannot be restored because it already exists or the undo details are invalid.");
        }
        String name = deletion.name().trim();
        departmentRepository.save(new Department(name));

        List<Employee> employees = deletion.employeeIds() == null
                ? new ArrayList<>()
                : employeeRepository.findAllById(deletion.employeeIds());
        employees.stream()
                .filter(employee -> deletion.moveTo() == null
                        || employee.getDepartment().equalsIgnoreCase(deletion.moveTo()))
                .forEach(employee -> employee.setDepartment(name));
        employeeRepository.saveAll(employees);

        if (deletion.accountDepartments() != null) {
            for (AccountDepartment snapshot : deletion.accountDepartments()) {
                if (snapshot.accountId() == null) continue;
                userRepository.findById(snapshot.accountId()).ifPresent(account -> {
                    if (deletion.moveTo() == null
                            || (account.getDepartment() != null
                            && account.getDepartment().equalsIgnoreCase(deletion.moveTo()))) {
                        account.setDepartment(snapshot.department());
                        userRepository.save(account);
                    }
                });
            }
        }

        activityService.record(actor, "DEPARTMENT_RESTORED",
                "Restored department " + name);
        return ResponseEntity.noContent().build();
    }

    private String normalize(String name) {
        return name == null || name.isBlank() ? null : name.trim();
    }

    private String key(String name) {
        return name == null ? "" : name.trim().toLowerCase(Locale.ROOT);
    }

    private UserAccount requireHrOrAdmin(String authorization) {
        UserAccount actor = activityService.requireActor(authorization);
        String role = actor.getRole().toUpperCase(Locale.ROOT);
        if (!"ADMIN".equals(role) && !"HR_MANAGER".equals(role)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "Only HR and Admin users can manage departments.");
        }
        return actor;
    }

    public record DepartmentRequest(String name) {}
    public record DepartmentRemovalRequest(String moveTo) {}
    public record AccountDepartment(Long accountId, String department) {}
    public record DepartmentDeletion(
            String name,
            String moveTo,
            List<String> employeeIds,
            List<AccountDepartment> accountDepartments) {}
}
