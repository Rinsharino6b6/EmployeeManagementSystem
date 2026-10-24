
package com.employee.backend;

import jakarta.persistence.*;

@Entity
@Table(name = "used_registration_passcodes")
public class UsedRegistrationPasscode {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 64)
    private String codeDigest;

    @Column(nullable = false, length = 20)
    private String role;

    protected UsedRegistrationPasscode() {}

    public UsedRegistrationPasscode(String codeDigest, String role) {
        this.codeDigest = codeDigest;
        this.role = role;
    }

    public Long getId() {
        return id;
    }

    public String getCodeDigest() {
        return codeDigest;
    }

    public String getRole() {
        return role;
    }
}
