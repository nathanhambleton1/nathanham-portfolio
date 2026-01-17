# Beer Ball Tournament - Quick Reference Guide

## 🎯 Workflow

```
1. ADD PLAYERS
   ↓
2. GENERATE TEAMS (Random or Skill-Based)
   ↓
3. ADJUST TEAMS (Optional - Drag & Drop)
   ↓
4. CONFIGURE TOURNAMENT
   • Single or Double Elimination
   • Byes, Third Place, Grand Final Reset
   ↓
5. GENERATE BRACKET
   ↓
6. RUN MATCHES (Click winners)
   ↓
7. CHAMPION CROWNED! 🏆
```

## 🎮 Controls

### Player Management
| Action | How |
|--------|-----|
| Add Player | Type name → Press Enter or Click + |
| Remove Player | Click X on player tag |

### Team Generation
| Mode | Description | When to Use |
|------|-------------|-------------|
| **Random** | Shuffle players | Quick casual games |
| **Skill-Based** | Rank & balance | Competitive tournaments |

### Team Adjustment
| Action | Steps |
|--------|-------|
| Enable Editing | Click "Adjust Teams" |
| Move Player | Drag player to different team |
| Lock Changes | Click "Lock Teams" |
| Apply | Click "Re-generate Bracket" |

### Tournament Types

#### Single Elimination
- **Speed**: ⚡⚡⚡ Fast
- **Matches**: Fewest
- **Fairness**: ⚖️⚖️ One loss = out
- **Best For**: Quick tournaments, time limits

#### Double Elimination  
- **Speed**: ⚡⚡ Moderate
- **Matches**: ~2x single elimination
- **Fairness**: ⚖️⚖️⚖️ Second chances
- **Best For**: Fair competition, longer events

## 📊 Match Interaction

```
┌─────────────────────┐
│   MATCH CARD        │
├─────────────────────┤
│ [Team A] ← Click    │ ✓ Winner gets trophy icon
│     VS              │ ✓ Advances automatically
│ [Team B] ← Click    │ ✓ Loser handled per format
├─────────────────────┤
│ Reset Match         │ ← Undo if needed
└─────────────────────┘
```

## 🏆 Bracket Examples

### Single Elimination (4 Teams)
```
SEMI-FINALS          FINALS          CHAMPION
┌─────────┐                            
│ Team 1  │─┐                          
└─────────┘ │         
            ├─────→ Winner ─┐         
┌─────────┐ │               │         
│ Team 4  │─┘               │         
└─────────┘                 ├─────→  🏆
                            │
┌─────────┐                 │
│ Team 2  │─┐               │
└─────────┘ │               │
            ├─────→ Winner ─┘
┌─────────┐ │
│ Team 3  │─┘
└─────────┘
```

### Double Elimination (4 Teams)
```
UPPER BRACKET              LOWER BRACKET          GRAND FINAL
┌────────┐                                            
│ Team 1 │─┐                                          
└────────┘ │                                          
           ├──→ W1 ─┐                                
┌────────┐ │        │                                
│ Team 4 │─┘        │                                
└────────┘          ├──→ UF ──┐                     
                    │          │                      
┌────────┐          │          │     ┌──────┐        
│ Team 2 │─┐        │          └─────┤ GF   │─→ 🏆  
└────────┘ │        │                └──────┘        
           ├──→ W2 ─┘                    ↑           
┌────────┐ │                             │           
│ Team 3 │─┘         L1 ─┐               │           
└────────┘                │               │           
                          ├──→ LW1 ─┐     │           
           L2 ────────────┘          │     │           
                                     ├─────┘           
                                     │                 
                          L(UF) ─────┘                 

UF = Upper Final
GF = Grand Final  
L() = Loser from upper bracket
```

## ⚙️ Settings Cheat Sheet

| Setting | Single | Double | Description |
|---------|--------|--------|-------------|
| **Allow Byes** | ✅ | ✅ | Auto-advance for odd teams |
| **Bye Strategy** | ✅ | ✅ | Top seeds or random |
| **Third Place** | ✅ | ❌ | Semi-final losers play |
| **Grand Final Reset** | ❌ | ✅ | Best-of-2 finals |
| **Re-seed** | 🔜 | 🔜 | Coming soon |

## 🎲 Skill-Based Team Generation

### How It Works
1. Rank players in 3 categories (best → worst)
2. System scores each player (1-10 per category)
3. Average scores calculated
4. Snake draft: 1→N, N→1, 1→N...

### Example: 6 Players → 3 Teams
```
Rankings:
  Throwing:  Alice, Bob, Carol, Dave, Eve, Frank
  Drinking:  Bob, Alice, Eve, Carol, Frank, Dave
  Defense:   Carol, Alice, Bob, Eve, Dave, Frank

Scores (averaged):
  Alice: 9.3
  Bob: 8.7
  Carol: 7.7
  Eve: 5.3
  Dave: 3.7
  Frank: 2.3

Snake Draft:
  Pick 1: Team A gets Alice (9.3)    ─┐
  Pick 2: Team B gets Bob (8.7)      ─┤ Forward
  Pick 3: Team C gets Carol (7.7)    ─┘
  Pick 4: Team C gets Eve (5.3)      ─┐
  Pick 5: Team B gets Dave (3.7)     ─┤ Backward
  Pick 6: Team A gets Frank (2.3)    ─┘

Result:
  Team A: Alice (9.3) + Frank (2.3) = 11.6 avg
  Team B: Bob (8.7) + Dave (3.7) = 12.4 avg
  Team C: Carol (7.7) + Eve (5.3) = 13.0 avg
  
  → Balanced teams! ⚖️
```

## 💡 Pro Tips

1. **Byes**: If you have odd teams, enable byes and use "Top Seeds" strategy
2. **Third Place**: Enable for single elimination if you want to recognize 3rd
3. **Adjustments**: Use drag-and-drop BEFORE generating bracket
4. **Reset**: You can reset any match if there was a mistake
5. **Stats**: Check team statistics to see elimination status
6. **Double Elim**: Grand final reset makes it more fair for upper bracket winner

## 🚨 Common Scenarios

### "I have 5 teams"
✅ Enable "Allow Byes" + "Top Seeds" strategy
→ Top 3 seeds get byes in round 1

### "I want the fairest tournament"
✅ Use Double Elimination + Grand Final Reset
→ Every team gets at least 2 games

### "Quick 30-minute tournament"
✅ Single Elimination, no third place
→ Minimal matches

### "Teams are unbalanced"
✅ Use "Adjust Teams" mode
→ Drag players between teams
→ Regenerate bracket

### "Someone has to leave"
❌ Remove from players, regenerate teams
→ Start over (no partial tournament editing yet)

## 📱 Mobile Tips

- Drag and drop works on touch screens
- Scroll horizontally for wide brackets
- Tap teams to select winners
- Settings panel is collapsible to save space

## 🎉 Beer Olympics Integration

When coming from Beer Olympics:
1. Players auto-loaded ✅
2. Run tournament normally
3. Champion crowned
4. Click "Send Results to Beer Olympics"
5. Points calculated:
   - 10 pts per win
   - 50 pts champion bonus
6. Auto-return to Olympics

---

**Made with 🍺 for competitive drinking games**
