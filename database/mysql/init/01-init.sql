-- AETHERIS MySQL 9.7 Initialization Script
-- Ensures database and character set defaults exist for local/containerized runs.

CREATE DATABASE IF NOT EXISTS aetheris
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE aetheris;
