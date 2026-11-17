!macro customInstall
  WriteRegStr HKCU "Software\Classes\AppUserModelId\com.viniciusromeiro.elefante" "DisplayName" "Elefante"
  WriteRegStr HKCU "Software\Classes\AppUserModelId\com.viniciusromeiro.elefante" "IconUri" "$INSTDIR\resources\elefante-lime.ico"
  WriteRegStr HKCU "Software\Classes\AppUserModelId\com.viniciusromeiro.elefante" "IconBackgroundColor" "00000000"
!macroend
