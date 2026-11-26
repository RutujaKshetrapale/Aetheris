package com.aetheris.domain.exception;

public class EngineNotReadyException extends RuntimeException {
    public EngineNotReadyException(String message) {
        super(message);
    }
}
