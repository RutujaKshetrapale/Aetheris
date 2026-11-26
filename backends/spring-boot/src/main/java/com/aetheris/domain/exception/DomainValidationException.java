package com.aetheris.domain.exception;

import java.util.Collections;
import java.util.Map;

public class DomainValidationException extends IllegalArgumentException {
    private final Map<String, Object> errors;

    public DomainValidationException(String message) {
        super(message);
        this.errors = null;
    }

    public DomainValidationException(String message, Map<String, Object> errors) {
        super(message);
        this.errors = errors == null ? null : Collections.unmodifiableMap(errors);
    }

    public Map<String, Object> getErrors() {
        return errors;
    }
}
