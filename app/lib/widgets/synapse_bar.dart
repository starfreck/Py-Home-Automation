import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/home_provider.dart';
import '../theme/app_theme.dart';

class SynapseBar extends StatefulWidget {
  const SynapseBar({super.key});

  @override
  State<SynapseBar> createState() => _SynapseBarState();
}

class _SynapseBarState extends State<SynapseBar> {
  final TextEditingController _controller = TextEditingController();

  final List<String> _quickPrompts = [
    'Cinema Mode',
    'Turn off all relays',
    'Lock front door',
    'Diagnostic status',
    'Eco power save',
  ];

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _sendPrompt(HomeProvider provider, String text) {
    if (text.trim().isEmpty) return;
    provider.submitVoiceCommand(text.trim());
    _controller.clear();
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<HomeProvider>();

    return Container(
      decoration: BoxDecoration(
        color: AppTheme.card,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: AppTheme.primary.withValues(alpha: 0.3),
          width: 1.2,
        ),
        boxShadow: [
          BoxShadow(
            color: AppTheme.primary.withValues(alpha: 0.08),
            blurRadius: 18,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [AppTheme.primary, Color(0xFFE58D6E)],
                  ),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(
                  Icons.auto_awesome_rounded,
                  color: Colors.white,
                  size: 16,
                ),
              ),
              const SizedBox(width: 8),
              const Flexible(
                child: Text(
                  'Gemma 4 Synapse',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.textMain,
                    letterSpacing: -0.2,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                decoration: BoxDecoration(
                  color: AppTheme.accentGreen.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: AppTheme.accentGreen.withValues(alpha: 0.4),
                    width: 0.8,
                  ),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.bolt, size: 10, color: AppTheme.accentGreen),
                    SizedBox(width: 2),
                    Text(
                      'EDGE AI',
                      style: TextStyle(
                        fontSize: 9,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.5,
                        color: AppTheme.accentGreen,
                      ),
                    ),
                  ],
                ),
              ),
              const Spacer(),
              if (provider.isAiThinking)
                const SizedBox(
                  width: 14,
                  height: 14,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    valueColor: AlwaysStoppedAnimation<Color>(AppTheme.primary),
                  ),
                ),
            ],
          ),

          const SizedBox(height: 12),

          // Response Banner if recent
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: AppTheme.surface.withValues(alpha: 0.9),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: AppTheme.cardBorder,
                width: 1,
              ),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(
                  Icons.chat_bubble_outline_rounded,
                  size: 14,
                  color: AppTheme.accentCyan,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    provider.isAiThinking
                        ? 'Synthesizing edge directive...'
                        : provider.lastAssistantReply,
                    style: TextStyle(
                      fontSize: 12,
                      fontStyle: provider.isAiThinking ? FontStyle.italic : FontStyle.normal,
                      color: provider.isAiThinking ? AppTheme.accentCyan : AppTheme.textMain,
                      height: 1.35,
                    ),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 12),

          // Input field
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _controller,
                  onSubmitted: (val) => _sendPrompt(provider, val),
                  style: const TextStyle(
                    fontSize: 13,
                    color: AppTheme.textMain,
                  ),
                  decoration: InputDecoration(
                    hintText: "Type directive (e.g. 'Turn off kitchen light')...",
                    hintStyle: const TextStyle(
                      fontSize: 13,
                      color: AppTheme.textDim,
                    ),
                    filled: true,
                    fillColor: AppTheme.surface,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: AppTheme.cardBorder),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: AppTheme.cardBorder),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: AppTheme.primary, width: 1.5),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              IconButton.filled(
                style: IconButton.styleFrom(
                  backgroundColor: AppTheme.primary,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                onPressed: () => _sendPrompt(provider, _controller.text),
                icon: const Icon(Icons.arrow_forward_rounded, size: 18),
              ),
            ],
          ),

          const SizedBox(height: 10),

          // Suggestion Chips
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: _quickPrompts.map((prompt) {
                return Padding(
                  padding: const EdgeInsets.only(right: 6),
                  child: ActionChip(
                    label: Text(prompt),
                    labelStyle: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                      color: AppTheme.textMuted,
                    ),
                    backgroundColor: AppTheme.surface,
                    side: const BorderSide(color: AppTheme.cardBorder, width: 0.8),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                    onPressed: () => _sendPrompt(provider, prompt),
                  ),
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }
}
