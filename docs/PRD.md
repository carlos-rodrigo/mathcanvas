# MathCanvas — Product Requirements Document

## Overview

MathCanvas is an AI-powered math tutor that teaches fractions to elementary school students (6th grade, Argentina curriculum) through an interactive full-screen whiteboard experience with bidirectional voice interaction.

## Problem

Kids struggle with abstract math concepts like fractions. Traditional methods (textbooks, worksheets) don't engage visual/auditory learners. A private tutor is expensive and not always available. Kids with ADHD especially need dynamic, visual, interactive explanations.

## Target User

- **Primary:** 11-12 year old students (6th grade Argentina)
- **Context:** Used alone, without parent supervision
- **Device:** Desktop/laptop web browser (Chrome primary)
- **Language:** Spanish (Argentina)

## Core Experience

The entire screen is a whiteboard. The AI tutor speaks to the student and draws visual explanations on the whiteboard in real-time. The student speaks back. There is no chat interface, no typing — it's like having a private tutor with a whiteboard.

### User Flow (MVP)

1. Student opens the app → full-screen white canvas
2. AI greets by voice: "¡Hola! ¿En qué estás trabajando hoy?"
3. Student speaks: "No entiendo cómo multiplicar fracciones"
4. AI explains by speaking + drawing step by step on the canvas
5. AI gives a practice exercise
6. Student answers by voice
7. AI corrects visually, showing what went right/wrong

## Scope — MVP (Phase 1: Fractions)

### Topics Covered
- What is a fraction (visual representation)
- Equivalent fractions
- Comparing fractions
- Adding and subtracting fractions (same and different denominators)
- Multiplying fractions
- Dividing fractions
- Mixed numbers and improper fractions
- Word problems with fractions

### Visual Primitives (Canvas Components)
The LLM does NOT draw directly. It returns structured JSON commands. The frontend renders these primitives:

- **PieChart** — Circle divided into equal slices, with N highlighted (e.g., 3/4 of a pizza)
- **FractionBar** — Horizontal bar divided into segments, with N filled
- **NumberLine** — Number line with points marked
- **FractionDisplay** — Large styled fraction (numerator/denominator with division line)
- **Operation** — Math operation layout (e.g., 2/3 × 4/5 = ?)
- **StepByStep** — Sequential steps with arrows showing the process
- **TextBubble** — Text annotation on the canvas
- **Arrow** — Connecting arrows between elements
- **Highlight** — Glow/emphasis on a specific element

### Interaction Model
- **Input:** Web Speech API (browser native speech-to-text)
- **Output (voice):** Text-to-speech (OpenAI TTS or ElevenLabs) — must sound natural, not robotic
- **Output (visual):** Canvas renders JSON commands from LLM
- **Language:** All interaction in Spanish (Argentina)

## Architecture

### Tech Stack
| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | Next.js 14+ (App Router) + TypeScript | Fast prototyping, SSR for initial load |
| Canvas | HTML5 Canvas via Konva.js or custom React components | Full-screen rendering, animations |
| Speech-to-Text | Web Speech API | Free, no backend needed, works in Chrome |
| Text-to-Speech | OpenAI TTS API or ElevenLabs | Natural voice quality critical for engagement |
| AI Brain | Claude API (Anthropic) | Structured output, strong reasoning for math |
| Styling | Tailwind CSS | Rapid UI development |

### LLM Integration Pattern

The LLM receives the conversation context and returns structured JSON:

```json
{
  "speech": "Mirá, una fracción es como partir una pizza en partes iguales. Si la partimos en 4 y nos comemos 1, eso es un cuarto.",
  "canvas_commands": [
    {
      "action": "clear"
    },
    {
      "action": "draw",
      "element": {
        "type": "PieChart",
        "id": "pizza1",
        "x": 400,
        "y": 300,
        "radius": 150,
        "slices": 4,
        "highlighted": [0],
        "colors": { "base": "#E5E7EB", "highlighted": "#F59E0B" },
        "label": "1/4",
        "animation": "draw-in"
      }
    },
    {
      "action": "draw",
      "element": {
        "type": "FractionDisplay",
        "id": "fraction1",
        "x": 700,
        "y": 300,
        "numerator": 1,
        "denominator": 4,
        "size": "large",
        "animation": "fade-in"
      }
    }
  ],
  "exercise": null,
  "waiting_for_response": false
}
```

### System Prompt Strategy

The AI tutor has a carefully crafted system prompt that:
- Speaks like a friendly Argentine tutor (vos, informal)
- Breaks complex concepts into small visual steps
- Always draws before explaining verbally
- Gives positive reinforcement
- Adapts difficulty based on student responses
- Uses real-world analogies (pizza, chocolate, etc.)

## Non-Functional Requirements

- **Performance:** Canvas renders must feel instant (<100ms)
- **Voice latency:** Speech-to-text + LLM + TTS should feel conversational (<3s total)
- **Accessibility:** Large, clear visuals. High contrast. Big touch targets.
- **Mobile:** Not required for MVP (desktop/laptop only)
- **Auth:** None for MVP (single user, no persistence)
- **Persistence:** No session persistence for MVP

## Success Metrics

- Toto can explain fractions after 3 sessions
- Toto voluntarily uses the app (engagement)
- Time-on-task > 10 minutes per session
- Correct answer rate improves over sessions

## Future Phases (NOT in MVP)

- Phase 2: Other math topics (decimals, percentages, geometry)
- Phase 3: User accounts, progress tracking, parent dashboard
- Phase 4: Multi-language support
- Phase 5: Mobile/tablet support with touch drawing
- Phase 6: Multiplayer/classroom mode
