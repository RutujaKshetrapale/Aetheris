package com.aetheris.domain.exception;

import java.util.Collections;
import java.util.Map;

public class SchemaValidationException extends IllegalArgumentException {
    private final Map<String, Object> errors;

    public SchemaValidationException(String message) {
        super(message);
        this.errors = null;
    }

    public SchemaValidationException(String message, Throwable cause) {
        super(message, cause);
        this.errors = null;
    }

    public SchemaValidationException(String message, Map<String, Object> errors) {
        super(message);
        this.errors = errors == null ? null : Collections.unmodifiableMap(errors);
    }

    public Map<String, Object> getErrors() {
        return errors;
    }
}
