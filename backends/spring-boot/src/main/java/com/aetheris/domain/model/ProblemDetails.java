package com.aetheris.domain.model;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.Map;

public class ProblemDetails {
    private String type;
    private String title;
    private int status;
    private String detail;
    private String instance;

    @JsonInclude(JsonInclude.Include.NON_NULL)
    private Map<String, Object> errors;

    public ProblemDetails() {}

    public ProblemDetails(String type, String title, int status, String detail, String instance) {
        this(type, title, status, detail, instance, null);
    }

    public ProblemDetails(String type, String title, int status, String detail, String instance, Map<String, Object> errors) {
        this.type = type;
        this.title = title;
        this.status = status;
        this.detail = detail;
        this.instance = instance;
        this.errors = errors;
    }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public int getStatus() { return status; }
    public void setStatus(int status) { this.status = status; }

    public String getDetail() { return detail; }
    public void setDetail(String detail) { this.detail = detail; }

    public String getInstance() { return instance; }
    public void setInstance(String instance) { this.instance = instance; }

    public Map<String, Object> getErrors() { return errors; }
    public void setErrors(Map<String, Object> errors) { this.errors = errors; }
}
