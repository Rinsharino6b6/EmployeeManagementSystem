package com.employee.backend;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

class ProfileControllerTest {

    private UserAccountRepository users;
    private EmployeeRepository employees;
    private AuthService authService;
    private ActivityService activityService;
    private ProfileController controller;
    private UserAccount actor;
    private UserAccount account;

    @BeforeEach
    void setUp() {
        users = mock(UserAccountRepository.class);
        employees = mock(EmployeeRepository.class);
        authService = mock(AuthService.class);
        activityService = mock(ActivityService.class);
        controller = new ProfileController(
                users, employees, authService, activityService);

        actor = mock(UserAccount.class);
        when(actor.getRole()).thenReturn("HR_MANAGER");
        when(activityService.requireActor("Bearer token")).thenReturn(actor);

        account = new UserAccount();
        when(users.findById(12L)).thenReturn(Optional.of(account));
        when(users.save(any(UserAccount.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void hrCanLinkAnExistingEmployeeRecordToAnAccount() {
        when(employees.existsById("E-104")).thenReturn(true);
        when(users.existsByEmployeeId("E-104")).thenReturn(false);

        ProfileController.ProfileResponse response =
                controller.linkEmployeeRecord(
                        12L,
                        new ProfileController.EmployeeLinkRequest("E-104"),
                        "Bearer token");

        assertEquals("E-104", account.getEmployeeId());
        assertEquals("E-104", response.employeeId());
        verify(activityService).record(
                actor,
                "EMPLOYEE_ACCOUNT_LINKED",
                "Linked employee record E-104 to account 12");
    }

    @Test
    void employeeRecordCannotBeLinkedToMultipleAccounts() {
        when(employees.existsById("E-104")).thenReturn(true);
        when(users.existsByEmployeeId("E-104")).thenReturn(true);

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> controller.linkEmployeeRecord(
                        12L,
                        new ProfileController.EmployeeLinkRequest("E-104"),
                        "Bearer token"));

        assertEquals(HttpStatus.CONFLICT, exception.getStatusCode());
    }

    @Test
    void employeesCannotManageAccountLinks() {
        when(actor.getRole()).thenReturn("EMPLOYEE");

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> controller.linkEmployeeRecord(
                        12L,
                        new ProfileController.EmployeeLinkRequest("E-104"),
                        "Bearer token"));

        assertEquals(HttpStatus.FORBIDDEN, exception.getStatusCode());
    }
}
