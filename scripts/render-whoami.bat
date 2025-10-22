@echo off
wsl bash -c "source ~/.bashrc && render whoami --output text 2>/dev/null || render whoami --output text"
