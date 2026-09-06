Unicode true
RequestExecutionLevel user
SetCompressor /SOLID lzma
SetCompressorDictSize 64

!define PRODUCT_NAME "Gemma Greetings"
!define PRODUCT_VERSION "1.0.8"
!define APP_EXE "Gemma Greetings.exe"
!define DESKTOP_SHORTCUT "Greeting Cards"

Name "${PRODUCT_NAME} ${PRODUCT_VERSION}"
OutFile "..\dist\Greeting-Cards-installer.exe"
InstallDir "$LOCALAPPDATA\Programs\${PRODUCT_NAME}"
BrandingText ""
AutoCloseWindow true
ShowInstDetails nevershow

Page instfiles
UninstPage uninstConfirm
UninstPage instfiles

Section "Install"
  SetOutPath "$INSTDIR"
  File /r "..\dist\win-unpacked\*.*"
  CreateDirectory "$DESKTOP"
  Delete "$DESKTOP\Gemma Greetings.lnk"
  CreateShortcut "$DESKTOP\${DESKTOP_SHORTCUT}.lnk" "$INSTDIR\${APP_EXE}"
  CreateDirectory "$SMPROGRAMS\${PRODUCT_NAME}"
  CreateShortcut "$SMPROGRAMS\${PRODUCT_NAME}\${PRODUCT_NAME}.lnk" "$INSTDIR\${APP_EXE}"
  CreateShortcut "$SMPROGRAMS\${PRODUCT_NAME}\Uninstall ${PRODUCT_NAME}.lnk" "$INSTDIR\Uninstall ${PRODUCT_NAME}.exe"
  WriteUninstaller "$INSTDIR\Uninstall ${PRODUCT_NAME}.exe"
  Exec '"$INSTDIR\${APP_EXE}"'
SectionEnd

Section "Uninstall"
  Delete "$DESKTOP\${DESKTOP_SHORTCUT}.lnk"
  Delete "$DESKTOP\Gemma Greetings.lnk"
  Delete "$SMPROGRAMS\${PRODUCT_NAME}\${PRODUCT_NAME}.lnk"
  Delete "$SMPROGRAMS\${PRODUCT_NAME}\Uninstall ${PRODUCT_NAME}.lnk"
  RMDir "$SMPROGRAMS\${PRODUCT_NAME}"
  RMDir /r "$INSTDIR"
SectionEnd
