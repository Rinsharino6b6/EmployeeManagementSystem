
package com.employee.backend;

import org.springframework.data.jpa.repository.JpaRepository;

public interface UsedRegistrationPasscodeRepository
        extends JpaRepository<UsedRegistrationPasscode, Long> {

    boolean existsByCodeDigest(String codeDigest);
}
