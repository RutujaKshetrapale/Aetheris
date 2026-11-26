package com.aetheris.adapter.web;

import com.aetheris.domain.exception.*;
import com.aetheris.domain.model.ProblemDetails;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final MediaType PROBLEM_JSON = MediaType.parseMediaType("application/problem+json");

    private ResponseEntity<ProblemDetails> problem(
            HttpStatus status,
            String type,
            String title,
            String detail,
            HttpServletRequest request,
            Map<String, Object> errors) {
        String instance = request != null ? request.getRequestURI() : "/";
        ProblemDetails body = new ProblemDetails(type, title, status.value(), detail, instance, errors);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(PROBLEM_JSON);
        return new ResponseEntity<>(body, headers, status);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ProblemDetails> handleUnreadableJson(HttpMessageNotReadableException ex, HttpServletRequest request) {
        return problem(
                HttpStatus.BAD_REQUEST,
                "https://aetheris.dev/errors/bad-request",
                "Malformed Request Payload",
                "Request body is missing, contains malformed JSON, or includes invalid field types/enum values.",
                request,
                null
        );
    }

    @ExceptionHandler({MethodArgumentTypeMismatchException.class, MethodArgumentNotValidException.class})
    public ResponseEntity<ProblemDetails> handleBadBinding(Exception ex, HttpServletRequest request) {
        return problem(
                HttpStatus.BAD_REQUEST,
                "https://aetheris.dev/errors/bad-request",
                "Invalid Request Parameters",
                "Request parameters failed schema validation.",
                request,
                null
        );
    }

    @ExceptionHandler(SchemaValidationException.class)
    public ResponseEntity<ProblemDetails> handleSchemaValidation(SchemaValidationException ex, HttpServletRequest request) {
        return problem(
                HttpStatus.BAD_REQUEST,
                "https://aetheris.dev/errors/bad-request",
                "Invalid Request Parameters",
                ex.getMessage(),
                request,
                ex.getErrors()
        );
    }

    @ExceptionHandler(DomainValidationException.class)
    public ResponseEntity<ProblemDetails> handleDomainValidation(DomainValidationException ex, HttpServletRequest request) {
        return problem(
                HttpStatus.UNPROCESSABLE_CONTENT,
                "https://aetheris.dev/errors/unprocessable-entity",
                "Unprocessable Domain Constraints",
                ex.getMessage(),
                request,
                ex.getErrors()
        );
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ProblemDetails> handleIllegalArgument(IllegalArgumentException ex, HttpServletRequest request) {
        return problem(
                HttpStatus.BAD_REQUEST,
                "https://aetheris.dev/errors/bad-request",
                "Invalid Request Parameters",
                ex.getMessage(),
                request,
                null
        );
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ProblemDetails> handleNotFound(ResourceNotFoundException ex, HttpServletRequest request) {
        return problem(
                HttpStatus.NOT_FOUND,
                "https://aetheris.dev/errors/not-found",
                "Resource Not Found",
                ex.getMessage(),
                request,
                null
        );
    }

    @ExceptionHandler(ConflictException.class)
    public ResponseEntity<ProblemDetails> handleConflict(ConflictException ex, HttpServletRequest request) {
        return problem(
                HttpStatus.CONFLICT,
                "https://aetheris.dev/errors/conflict",
                "Resource Conflict",
                ex.getMessage(),
                request,
                null
        );
    }

    @ExceptionHandler(PersistenceUnavailableException.class)
    public ResponseEntity<ProblemDetails> handlePersistenceUnavailable(PersistenceUnavailableException ex, HttpServletRequest request) {
        return problem(
                HttpStatus.SERVICE_UNAVAILABLE,
                "https://aetheris.dev/errors/service-unavailable",
                "Persistence Layer Unavailable",
                ex.getMessage(),
                request,
                Map.of("persistenceEngine", ex.getAdapterType())
        );
    }

    @ExceptionHandler(EngineNotReadyException.class)
    public ResponseEntity<ProblemDetails> handleEngineNotReady(EngineNotReadyException ex, HttpServletRequest request) {
        return problem(
                HttpStatus.SERVICE_UNAVAILABLE,
                "https://aetheris.dev/errors/engine-not-ready",
                "Algorithm Engine Not Ready",
                ex.getMessage(),
                request,
                null
        );
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ProblemDetails> handleNoResource(NoResourceFoundException ex, HttpServletRequest request) {
        return problem(
                HttpStatus.NOT_FOUND,
                "https://aetheris.dev/errors/not-found",
                "Endpoint Not Found",
                "The requested endpoint does not exist.",
                request,
                null
        );
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ProblemDetails> handleMethodNotAllowed(HttpRequestMethodNotSupportedException ex, HttpServletRequest request) {
        return problem(
                HttpStatus.METHOD_NOT_ALLOWED,
                "https://aetheris.dev/errors/method-not-allowed",
                "Method Not Allowed",
                "HTTP method " + ex.getMethod() + " is not supported for this endpoint.",
                request,
                null
        );
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<ProblemDetails> handleUnsupportedMediaType(HttpMediaTypeNotSupportedException ex, HttpServletRequest request) {
        return problem(
                HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                "https://aetheris.dev/errors/unsupported-media-type",
                "Unsupported Media Type",
                "Content-Type must be application/json.",
                request,
                null
        );
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ProblemDetails> handleUnexpected(Exception ex, HttpServletRequest request) {
        return problem(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "https://aetheris.dev/errors/internal-server-error",
                "Internal Server Error",
                "An unexpected internal error occurred.",
                request,
                null
        );
    }
}
