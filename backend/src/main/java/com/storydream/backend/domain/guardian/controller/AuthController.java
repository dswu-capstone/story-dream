//package com.storydream.backend.domain.guardian.controller;
//
//import com.storydream.backend.domain.guardian.dto.GuardianResponse;
//import com.storydream.backend.domain.guardian.dto.LoginRequest;
//import com.storydream.backend.domain.guardian.dto.LoginResponse;
//import com.storydream.backend.domain.guardian.dto.SignupRequest;
//import com.storydream.backend.domain.guardian.service.AuthService;
//import com.storydream.backend.global.response.ApiResponse;
//import jakarta.validation.Valid;
//import lombok.RequiredArgsConstructor;
//import org.springframework.http.HttpStatus;
//import org.springframework.http.ResponseEntity;
//import org.springframework.security.core.annotation.AuthenticationPrincipal;
//import org.springframework.web.bind.annotation.*;
//
//@RestController
//@RequestMapping("/api")
//@RequiredArgsConstructor
//public class AuthController {
//
//    private final AuthService authService;
//
//    @PostMapping("/auth/signup")
//    public ResponseEntity<ApiResponse<GuardianResponse>> signup(@Valid @RequestBody SignupRequest req) {
//        return ResponseEntity.status(HttpStatus.CREATED)
//                .body(ApiResponse.success(authService.signup(req)));
//    }
//
//    @PostMapping("/auth/login")
//    public ResponseEntity<ApiResponse<LoginResponse>> login(@Valid @RequestBody LoginRequest req) {
//        return ResponseEntity.ok(ApiResponse.success(authService.login(req)));
//    }
//
//    @GetMapping("/guardians/me")
//    public ResponseEntity<ApiResponse<GuardianResponse>> getMe(@AuthenticationPrincipal Integer guardianId) {
//        return ResponseEntity.ok(ApiResponse.success(authService.getMe(guardianId)));
//    }
//}

package com.storydream.backend.domain.guardian.controller;

import com.storydream.backend.domain.guardian.dto.GoogleLoginRequest;
import com.storydream.backend.domain.guardian.dto.GuardianResponse;
import com.storydream.backend.domain.guardian.dto.LoginRequest;
import com.storydream.backend.domain.guardian.dto.LoginResponse;
import com.storydream.backend.domain.guardian.dto.SignupRequest;
import com.storydream.backend.domain.guardian.service.AuthService;
import com.storydream.backend.domain.guardian.service.SocialAuthService;
import com.storydream.backend.global.response.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final SocialAuthService socialAuthService;

    @PostMapping("/auth/signup")
    public ResponseEntity<ApiResponse<GuardianResponse>> signup(@Valid @RequestBody SignupRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(authService.signup(req)));
    }

    @PostMapping("/auth/login")
    public ResponseEntity<ApiResponse<LoginResponse>> login(@Valid @RequestBody LoginRequest req) {
        return ResponseEntity.ok(ApiResponse.success(authService.login(req)));
    }

    @PostMapping("/auth/google")
    public ResponseEntity<ApiResponse<LoginResponse>> googleLogin(@Valid @RequestBody GoogleLoginRequest req) {
        return ResponseEntity.ok(ApiResponse.success(socialAuthService.googleLogin(req.code())));
    }

    @GetMapping("/guardians/me")
    public ResponseEntity<ApiResponse<GuardianResponse>> getMe(@AuthenticationPrincipal Integer guardianId) {
        return ResponseEntity.ok(ApiResponse.success(authService.getMe(guardianId)));
    }
}