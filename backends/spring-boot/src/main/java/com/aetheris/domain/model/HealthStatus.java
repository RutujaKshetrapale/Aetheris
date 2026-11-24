package com.aetheris.domain.model;

public class HealthStatus {
    private String status;
    private String engineStatus;
    private String persistenceStatus;
    private String platform;
    private String version;
    private String persistenceEngine;
    private boolean databaseConnected;

    public HealthStatus() {}

    public HealthStatus(String status, String engineStatus, String persistenceStatus, String platform, String version, String persistenceEngine, boolean databaseConnected) {
        this.status = status;
        this.engineStatus = engineStatus;
        this.persistenceStatus = persistenceStatus;
        this.platform = platform;
        this.version = version;
        this.persistenceEngine = persistenceEngine;
        this.databaseConnected = databaseConnected;
    }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getEngineStatus() { return engineStatus; }
    public void setEngineStatus(String engineStatus) { this.engineStatus = engineStatus; }

    public String getPersistenceStatus() { return persistenceStatus; }
    public void setPersistenceStatus(String persistenceStatus) { this.persistenceStatus = persistenceStatus; }

    public String getPlatform() { return platform; }
    public void setPlatform(String platform) { this.platform = platform; }

    public String getVersion() { return version; }
    public void setVersion(String version) { this.version = version; }

    public String getPersistenceEngine() { return persistenceEngine; }
    public void setPersistenceEngine(String persistenceEngine) { this.persistenceEngine = persistenceEngine; }

    public boolean isDatabaseConnected() { return databaseConnected; }
    public void setDatabaseConnected(boolean databaseConnected) { this.databaseConnected = databaseConnected; }
}
