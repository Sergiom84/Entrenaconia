@echo off
wsl bash -c "source ~/.bashrc && render services --output text 2>/dev/null || render services --output text"
