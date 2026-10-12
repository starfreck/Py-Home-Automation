import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/home_provider.dart';
import '../theme/app_theme.dart';

class LoginScreen extends StatefulWidget {
  final VoidCallback? onLoginSuccess;

  const LoginScreen({super.key, this.onLoginSuccess});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  bool _isRegister = false;
  final _formKey = GlobalKey<FormState>();

  final _urlController = TextEditingController(text: 'http://localhost:8080');
  final _nameController = TextEditingController(text: '');
  final _emailController = TextEditingController(text: 'alice@example.com');
  final _passwordController = TextEditingController(text: 'password123');

  bool _isLoading = false;
  String? _errorMessage;

  @override
  void dispose() {
    _urlController.dispose();
    _nameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final home = context.read<HomeProvider>();
    home.updateGatewayUrl(_urlController.text.trim());

    try {
      if (_isRegister) {
        await home.register(
          _nameController.text.trim().isNotEmpty ? _nameController.text.trim() : 'Home User',
          _emailController.text.trim(),
          _passwordController.text.trim(),
        );
      } else {
        await home.login(
          _emailController.text.trim(),
          _passwordController.text.trim(),
        );
      }
      widget.onLoginSuccess?.call();
    } catch (e) {
      setState(() {
        _errorMessage = e.toString().replaceAll('Exception:', '').trim();
      });
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 440),
            child: Card(
              color: AppTheme.card,
              elevation: 8,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(20),
                side: const BorderSide(color: AppTheme.cardBorder),
              ),
              child: Padding(
                padding: const EdgeInsets.all(28.0),
                child: Form(
                  key: _formKey,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // LOGO & HEADER
                      Center(
                        child: Container(
                          width: 56,
                          height: 56,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            gradient: const LinearGradient(
                              colors: [AppTheme.primary, AppTheme.accentCyan],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: AppTheme.primary.withValues(alpha: 0.3),
                                blurRadius: 16,
                                spreadRadius: 2,
                              )
                            ],
                          ),
                          child: const Icon(Icons.home_work_rounded, color: Colors.white, size: 28),
                        ),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        _isRegister ? 'Create Cloud Account' : 'Welcome to OmniHome',
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.bold,
                          color: AppTheme.textMain,
                        ),
                      ),
                      const SizedBox(height: 6),
                      const Text(
                        'Secure Multi-Tenant Cloud & Edge Bridge',
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 12, color: AppTheme.textMuted),
                      ),
                      const SizedBox(height: 24),

                      // TABS
                      Container(
                        decoration: BoxDecoration(
                          color: AppTheme.surface,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AppTheme.cardBorder),
                        ),
                        padding: const EdgeInsets.all(4),
                        child: Row(
                          children: [
                            Expanded(
                              child: GestureDetector(
                                onTap: () => setState(() => _isRegister = false),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(vertical: 10),
                                  decoration: BoxDecoration(
                                    color: !_isRegister ? AppTheme.card : Colors.transparent,
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  alignment: Alignment.center,
                                  child: Text(
                                    'Sign In',
                                    style: TextStyle(
                                      fontWeight: FontWeight.w600,
                                      fontSize: 13,
                                      color: !_isRegister ? AppTheme.primary : AppTheme.textMuted,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                            Expanded(
                              child: GestureDetector(
                                onTap: () => setState(() => _isRegister = true),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(vertical: 10),
                                  decoration: BoxDecoration(
                                    color: _isRegister ? AppTheme.card : Colors.transparent,
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  alignment: Alignment.center,
                                  child: Text(
                                    'Register',
                                    style: TextStyle(
                                      fontWeight: FontWeight.w600,
                                      fontSize: 13,
                                      color: _isRegister ? AppTheme.primary : AppTheme.textMuted,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 20),

                      // ERROR BANNER
                      if (_errorMessage != null) ...[
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: Colors.red.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: Colors.red.shade400.withValues(alpha: 0.5)),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.error_outline, color: Colors.redAccent, size: 20),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  _errorMessage!,
                                  style: const TextStyle(color: Colors.redAccent, fontSize: 12),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),
                      ],

                      // FORM FIELDS
                      if (_isRegister) ...[
                        TextFormField(
                          controller: _nameController,
                          style: const TextStyle(color: AppTheme.textMain, fontSize: 13),
                          decoration: InputDecoration(
                            labelText: 'Full Name',
                            labelStyle: const TextStyle(color: AppTheme.textMuted, fontSize: 12),
                            prefixIcon: const Icon(Icons.person_outline, size: 18, color: AppTheme.textMuted),
                            filled: true,
                            fillColor: AppTheme.surface,
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(10),
                              borderSide: const BorderSide(color: AppTheme.cardBorder),
                            ),
                          ),
                        ),
                        const SizedBox(height: 14),
                      ],

                      TextFormField(
                        controller: _emailController,
                        style: const TextStyle(color: AppTheme.textMain, fontSize: 13),
                        keyboardType: TextInputType.emailAddress,
                        validator: (val) => val == null || val.isEmpty ? 'Email is required' : null,
                        decoration: InputDecoration(
                          labelText: 'Email Address',
                          labelStyle: const TextStyle(color: AppTheme.textMuted, fontSize: 12),
                          prefixIcon: const Icon(Icons.email_outlined, size: 18, color: AppTheme.textMuted),
                          filled: true,
                          fillColor: AppTheme.surface,
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10),
                            borderSide: const BorderSide(color: AppTheme.cardBorder),
                          ),
                        ),
                      ),
                      const SizedBox(height: 14),

                      TextFormField(
                        controller: _passwordController,
                        style: const TextStyle(color: AppTheme.textMain, fontSize: 13),
                        obscureText: true,
                        validator: (val) => val == null || val.isEmpty ? 'Password is required' : null,
                        decoration: InputDecoration(
                          labelText: 'Password',
                          labelStyle: const TextStyle(color: AppTheme.textMuted, fontSize: 12),
                          prefixIcon: const Icon(Icons.lock_outline, size: 18, color: AppTheme.textMuted),
                          filled: true,
                          fillColor: AppTheme.surface,
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10),
                            borderSide: const BorderSide(color: AppTheme.cardBorder),
                          ),
                        ),
                      ),
                      const SizedBox(height: 14),

                      TextFormField(
                        controller: _urlController,
                        style: const TextStyle(color: AppTheme.textMuted, fontSize: 12),
                        decoration: InputDecoration(
                          labelText: 'Cloud Gateway Endpoint',
                          labelStyle: const TextStyle(color: AppTheme.textMuted, fontSize: 11),
                          prefixIcon: const Icon(Icons.cloud_outlined, size: 18, color: AppTheme.textMuted),
                          filled: true,
                          fillColor: AppTheme.surface,
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10),
                            borderSide: const BorderSide(color: AppTheme.cardBorder),
                          ),
                        ),
                      ),
                      const SizedBox(height: 22),

                      // SUBMIT BUTTON
                      ElevatedButton(
                        onPressed: _isLoading ? null : _submit,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppTheme.primary,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          elevation: 2,
                        ),
                        child: _isLoading
                            ? const SizedBox(
                                height: 18,
                                width: 18,
                                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                              )
                            : Text(
                                _isRegister ? 'Register & Connect' : 'Sign In to Dashboard',
                                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                              ),
                      ),
                      const SizedBox(height: 16),

                      // EDGE CLI HARDWARE NOTICE
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppTheme.surface,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: AppTheme.cardBorder),
                        ),
                        child: const Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(Icons.developer_board_rounded, color: AppTheme.accentGreen, size: 18),
                            SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                'Edge Device Notice: Run omnihome-edge login on your Raspberry Pi to bridge physical GPIO hardware to this tenant account.',
                                style: TextStyle(fontSize: 11, color: AppTheme.textMuted, height: 1.4),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
