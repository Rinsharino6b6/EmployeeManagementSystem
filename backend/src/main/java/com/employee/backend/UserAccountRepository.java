
package com.employee.backend;

import java.util.Optional;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserAccountRepository
        extends JpaRepository<UserAccount, Long> {

    Optional<UserAccount> findByUsernameIgnoreCase(String username);

    Optional<UserAccount> findByEmailIgnoreCase(String email);

    Optional<UserAccount> findBySessionTokenHash(String sessionTokenHash);

    Optional<UserAccount> findByEmployeeId(String employeeId);

    List<UserAccount> findAllByOrderByFullNameAsc();

    List<UserAccount> findAllByDepartmentIgnoreCase(String department);

    List<UserAccount> findAllByEmployeeIdIn(List<String> employeeIds);

    boolean existsByUsernameIgnoreCase(String username);

    boolean existsByEmailIgnoreCase(String email);

    boolean existsByEmployeeId(String employeeId);
}
