package com.employee.backend;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class AttendanceAuthorizationFilterTest {

    private UserAccountRepository userRepository;
    private SessionAuthorizationFilter filter;
    private UserAccount user;

    @BeforeEach
    void setUp() throws Exception {
        userRepository = mock(UserAccountRepository.class);
        filter = new SessionAuthorizationFilter(userRepository);
        user = mock(UserAccount.class);
        when(user.getId()).thenReturn(7L);
        when(user.getSessionTokenExpiresAt())
                .thenReturn(java.time.LocalDateTime.now().plusHours(1));
        when(userRepository.findBySessionTokenHash(hashToken("test-token")))
                .thenReturn(Optional.of(user));
    }

    @Test
    void employeeCannotReadAnotherEmployeesAttendance() throws Exception {
        when(user.getRole()).thenReturn("EMPLOYEE");
        MockHttpServletRequest request = attendanceRequest(
                "/api/attendance/8/history", "GET");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        assertEquals(403, response.getStatus());
        assertNull(chain.getRequest());
    }

    @Test
    void employeeCanReadTheirOwnAttendance() throws Exception {
        when(user.getRole()).thenReturn("EMPLOYEE");
        MockHttpServletRequest request = attendanceRequest(
                "/api/attendance/7/history", "GET");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        assertEquals(200, response.getStatus());
        assertNotNull(chain.getRequest());
    }

    @Test
    void hrCanReadCompanyAttendance() throws Exception {
        when(user.getRole()).thenReturn("HR_MANAGER");
        MockHttpServletRequest request = attendanceRequest(
                "/api/attendance", "GET");
        request.setParameter("requesterId", "7");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        assertEquals(200, response.getStatus());
        assertNotNull(chain.getRequest());
    }

    @Test
    void employeeCanReadOfficeAttendanceLocation() throws Exception {
        when(user.getRole()).thenReturn("EMPLOYEE");
        MockHttpServletRequest request = attendanceRequest(
                "/api/attendance/office-location", "GET");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        assertEquals(200, response.getStatus());
        assertNotNull(chain.getRequest());
    }

    @Test
    void employeeCannotChangeOfficeAttendanceLocation() throws Exception {
        when(user.getRole()).thenReturn("EMPLOYEE");
        MockHttpServletRequest request = attendanceRequest(
                "/api/attendance/office-location", "PUT");
        request.setParameter("requesterId", "7");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        assertEquals(403, response.getStatus());
        assertNull(chain.getRequest());
    }

    @Test
    void hrCanChangeOfficeAttendanceLocation() throws Exception {
        when(user.getRole()).thenReturn("HR_MANAGER");
        MockHttpServletRequest request = attendanceRequest(
                "/api/attendance/office-location", "PUT");
        request.setParameter("requesterId", "7");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        assertEquals(200, response.getStatus());
        assertNotNull(chain.getRequest());
    }

    @Test
    void employeeCanSubmitTheirOwnLeaveRequest() throws Exception {
        when(user.getRole()).thenReturn("EMPLOYEE");
        MockHttpServletRequest request = attendanceRequest(
                "/api/attendance/7/leave-requests", "POST");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        assertEquals(200, response.getStatus());
        assertNotNull(chain.getRequest());
    }

    @Test
    void employeeCannotSubmitLeaveRequestForAnotherAccount() throws Exception {
        when(user.getRole()).thenReturn("EMPLOYEE");
        MockHttpServletRequest request = attendanceRequest(
                "/api/attendance/8/leave-requests", "POST");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        assertEquals(403, response.getStatus());
        assertNull(chain.getRequest());
    }

    @Test
    void employeeCannotReviewAttendanceRequests() throws Exception {
        when(user.getRole()).thenReturn("EMPLOYEE");
        MockHttpServletRequest request = attendanceRequest(
                "/api/attendance/correction-requests/1/decision", "PUT");
        request.setParameter("requesterId", "7");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        assertEquals(403, response.getStatus());
        assertNull(chain.getRequest());
    }

    private MockHttpServletRequest attendanceRequest(
            String path,
            String method) {
        MockHttpServletRequest request = new MockHttpServletRequest(
                method, path);
        request.setRequestURI(path);
        request.addHeader("Authorization", "Bearer test-token");
        return request;
    }

    private String hashToken(String token) throws Exception {
        byte[] digest = MessageDigest.getInstance("SHA-256")
                .digest(token.getBytes(StandardCharsets.UTF_8));
        return Base64.getEncoder().withoutPadding().encodeToString(digest);
    }
}
