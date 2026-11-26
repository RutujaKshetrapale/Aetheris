package com.aetheris.domain.exception;

public class PersistenceUnavailableException extends RuntimeException {
    private final String adapterType;

    public PersistenceUnavailableException(String adapterType, String message) {
        super(message);
        this.adapterType = adapterType;
    }

    public String getAdapterType() {
        return adapterType;
    }
}
