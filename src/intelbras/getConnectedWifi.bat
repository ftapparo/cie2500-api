@echo off
netsh wlan show interfaces | findstr "SSID.*%ssid%"