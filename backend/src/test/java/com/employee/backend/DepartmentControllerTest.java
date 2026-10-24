package com.employee.backend;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

class DepartmentControllerTest {

    private EmployeeRepository employeeRepository;
    private UserAccountRepository userRepository;
    private ActivityService activityService;
    private DepartmentRepository departmentRepository;
    private DepartmentController departmentController;
    private UserAccount admin;

    @BeforeEach
    void setUp() {
        employeeRepository = mock(EmployeeRepository.class);
        userRepository = mock(UserAccountRepository.class);
        activityService = mock(ActivityService.class);
        departmentRepository = mock(DepartmentRepository.class);
        departmentController = new DepartmentController(
                departmentRepository,
                employeeRepository,
                userRepository,
                activityService);
        admin = mock(UserAccount.class);
        when(admin.getRole()).thenReturn("ADMIN");
        when(activityService.requireActor("Bearer test-token"))
                .thenReturn(admin);
    }

    @Test
    void departmentRemovalMovesEmployeeRecordsAndLinkedAccounts() {
        Employee employee = new Employee(
                "EMP-1", "Employee", "Old department", "Engineer", 50000);
        UserAccount linkedAccount = mock(UserAccount.class);
        when(employeeRepository.findAllByDepartmentIgnoreCase("Old department"))
                .thenReturn(List.of(employee));
        when(departmentRepository.findByNameIgnoreCase("Old department"))
                .thenReturn(Optional.of(new Department("Old department")));
        when(departmentRepository.existsByNameIgnoreCase("Engineering"))
                .thenReturn(true);
        when(userRepository.findAllByDepartmentIgnoreCase("Old department"))
                .thenReturn(new ArrayList<>());
        when(userRepository.findAllByEmployeeIdIn(List.of("EMP-1")))
                .thenReturn(List.of(linkedAccount));

        var response = departmentController.removeDepartment(
                "Old department",
                new DepartmentController.DepartmentRemovalRequest("Engineering"),
                "Bearer test-token");

        assertEquals("Old department", response.name());
        assertEquals("Engineering", response.moveTo());
        assertEquals("Engineering", employee.getDepartment());
        verify(linkedAccount).setDepartment("Engineering");
        verify(employeeRepository).saveAll(List.of(employee));
        verify(userRepository).saveAll(any());
        verify(departmentRepository).delete(any(Department.class));
        verify(activityService).record(
                admin,
                "DEPARTMENT_REMOVED",
                "Removed department Old department and moved employees to Engineering");
    }

    @Test
    void employeesCannotRemoveDepartments() {
        UserAccount employeeAccount = mock(UserAccount.class);
        when(employeeAccount.getRole()).thenReturn("EMPLOYEE");
        when(activityService.requireActor("Bearer test-token"))
                .thenReturn(employeeAccount);

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> departmentController.removeDepartment(
                        "Old department",
                        new DepartmentController.DepartmentRemovalRequest("Engineering"),
                        "Bearer test-token"));

        assertEquals(HttpStatus.FORBIDDEN, exception.getStatusCode());
        verify(employeeRepository, never())
                .findAllByDepartmentIgnoreCase(any());
    }

    @Test
    void undoRestoresDepartmentEmployeeAndLinkedAccountAssignments() {
        Employee employee = new Employee(
                "EMP-1", "Employee", "Engineering", "Engineer", 50000);
        UserAccount account = mock(UserAccount.class);
        when(employeeRepository.findAllById(List.of("EMP-1")))
                .thenReturn(List.of(employee));
        when(userRepository.findById(7L)).thenReturn(Optional.of(account));
        when(account.getDepartment()).thenReturn("Engineering");

        var response = departmentController.undoRemoval(
                new DepartmentController.DepartmentDeletion(
                        "Old department",
                        "Engineering",
                        List.of("EMP-1"),
                        List.of(new DepartmentController.AccountDepartment(
                                7L, "Old department"))),
                "Bearer test-token");

        assertEquals(HttpStatus.NO_CONTENT, response.getStatusCode());
        assertEquals("Old department", employee.getDepartment());
        verify(account).setDepartment("Old department");
        verify(departmentRepository).save(any(Department.class));
    }

    @Test
    void hrCanCreateAnEmptyDepartment() {
        when(departmentRepository.existsByNameIgnoreCase("Research"))
                .thenReturn(false, true);
        when(departmentRepository.findAll())
                .thenReturn(List.of(new Department("Research")));
        when(employeeRepository.findAll()).thenReturn(List.of());
        when(userRepository.findAll()).thenReturn(List.of());

        var response = departmentController.addDepartment(
                new DepartmentController.DepartmentRequest(" Research "),
                "Bearer test-token");

        assertEquals(HttpStatus.CREATED, response.getStatusCode());
        assertEquals(List.of("Research"), response.getBody());
        verify(departmentRepository).save(any(Department.class));
    }
}
