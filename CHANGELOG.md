# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [7.4.8] - 2026-01-08

## Bug Fixes

- **ProcessManager**: Add missing `logger` import that caused `ReferenceError` when PID file parsing failed during session startup
