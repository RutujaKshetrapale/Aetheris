package com.aetheris.domain.model;

public enum TraceAction {
    INITIALIZE,
    ENQUEUE_FRONTIER,
    DEQUEUE_FRONTIER,
    EXAMINE_NODE,
    UPDATE_METRICS,
    CLOSE_NODE,
    PATH_FOUND,
    NO_PATH_FOUND
}
