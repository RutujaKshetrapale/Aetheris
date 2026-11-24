package com.aetheris.domain.model;

public class ProbeStatus {
    private String status;

    public ProbeStatus() {}

    public ProbeStatus(String status) {
        this.status = status;
    }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
}
