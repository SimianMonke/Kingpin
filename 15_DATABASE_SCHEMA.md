# 15. DATABASE SCHEMA (Consolidated)

---

## OVERVIEW

Complete PostgreSQL database schema for Kingpin. All tables are defined with proper relationships, constraints, and indexes.

---

## CORE TABLES

### users
```sql
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    
    -- Platform Identities
    kick_user_id VARCHAR(255) UNIQUE,
    twitch_user_id VARCHAR(255) UNIQUE,
    discord_user_id VARCHAR(50) UNIQUE,
    
    -- Display
    username VARCHAR(100) NOT NULL,
    display_name VARCHAR(100),
    kingpin_name VARCHAR(100),
    
    -- Core Stats
    wealth BIGINT DEFAULT 0,
    xp BIGINT DEFAULT 0,
    level INTEGER DEFAULT 1,
    status_tier VARCHAR(50) DEFAULT 'Rookie',
    hp INTEGER DEFAULT 100,
    
    -- Check-in
    checkin_streak INTEGER DEFAULT 0,
    last_checkin_date DATE,
    
    -- Tracking
    total_play_count INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    
    -- Faction
    faction_id INTEGER REFERENCES factions(faction_id),
    joined_faction_at TIMESTAMP,
    
    -- Discord
    discord_username VARCHAR(100),
    discord_linked_at TIMESTAMP,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT check_positive_wealth CHECK (wealth >= 0),
    CONSTRAINT check_positive_xp CHECK (xp >= 0),
    CONSTRAINT check_positive_level CHECK (level >= 1)
);

CREATE INDEX idx_users_kick ON users(kick_user_id);
CREATE INDEX idx_users_twitch ON users(twitch_user_id);
CREATE INDEX idx_users_discord ON users(discord_user_id);
CREATE INDEX idx_users_level ON users(level);
CREATE INDEX idx_users_wealth ON users(wealth DESC);
CREATE INDEX idx_users_faction ON users(faction_id);
```

---

## ITEMS & INVENTORY

### items
```sql
CREATE TABLE items (
    item_id SERIAL PRIMARY KEY,
    item_name VARCHAR(100) NOT NULL UNIQUE,
    item_type VARCHAR(50) NOT NULL,
    tier VARCHAR(50) NOT NULL,
    
    -- Stats
    base_durability INTEGER DEFAULT 100,
    rob_bonus DECIMAL(5,2),
    defense_bonus DECIMAL(5,2),
    revenue_min INTEGER,
    revenue_max INTEGER,
    insurance_percent DECIMAL(5,2),
    
    -- Economy
    purchase_price INTEGER NOT NULL,
    sell_price INTEGER,
    
    -- Flavor
    description TEXT,
    flavor_text TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_items_type ON items(item_type);
CREATE INDEX idx_items_tier ON items(tier);
```

### user_inventory
```sql
CREATE TABLE user_inventory (
    inventory_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    item_id INTEGER REFERENCES items(item_id),
    
    durability INTEGER NOT NULL,
    is_equipped BOOLEAN DEFAULT FALSE,
    slot VARCHAR(50),
    
    is_escrowed BOOLEAN DEFAULT FALSE,
    escrow_expires_at TIMESTAMP,
    
    acquired_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    equipped_at TIMESTAMP
);

CREATE INDEX idx_inventory_user ON user_inventory(user_id);
CREATE INDEX idx_inventory_equipped ON user_inventory(user_id, is_equipped);
CREATE INDEX idx_inventory_escrow ON user_inventory(is_escrowed, escrow_expires_at);
```

---

## CRATES

### user_crates
```sql
CREATE TABLE user_crates (
    crate_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    crate_tier VARCHAR(20) NOT NULL,
    
    is_escrowed BOOLEAN DEFAULT FALSE,
    escrow_expires_at TIMESTAMP,
    
    acquired_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    source VARCHAR(50)
);

CREATE INDEX idx_crates_user ON user_crates(user_id);
CREATE INDEX idx_crates_escrow ON user_crates(is_escrowed, escrow_expires_at);
```

### crate_opens
```sql
CREATE TABLE crate_opens (
    open_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id),
    crate_tier VARCHAR(20) NOT NULL,
    
    drop_type VARCHAR(20) NOT NULL,
    item_id INTEGER REFERENCES items(item_id),
    item_tier VARCHAR(20),
    wealth_amount INTEGER,
    title_name VARCHAR(100),
    title_was_duplicate BOOLEAN,
    duplicate_conversion INTEGER,
    
    opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### crate_titles
```sql
CREATE TABLE crate_titles (
    title_id SERIAL PRIMARY KEY,
    title_name VARCHAR(100) NOT NULL UNIQUE,
    crate_tier VARCHAR(20) NOT NULL,
    duplicate_value INTEGER NOT NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## GAME EVENTS & COOLDOWNS

### game_events
```sql
CREATE TABLE game_events (
    event_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id),
    event_type VARCHAR(50) NOT NULL,
    
    wealth_change BIGINT DEFAULT 0,
    xp_change INTEGER DEFAULT 0,
    
    target_user_id INTEGER REFERENCES users(user_id),
    tier VARCHAR(50),
    event_description TEXT,
    
    success BOOLEAN DEFAULT TRUE,
    was_busted BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_events_user ON game_events(user_id);
CREATE INDEX idx_events_type ON game_events(event_type);
CREATE INDEX idx_events_date ON game_events(created_at);
```

### cooldowns
```sql
CREATE TABLE cooldowns (
    cooldown_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    command_type VARCHAR(50) NOT NULL,
    target_identifier VARCHAR(255),
    
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, command_type, target_identifier)
);

CREATE INDEX idx_cooldowns_user ON cooldowns(user_id);
CREATE INDEX idx_cooldowns_expires ON cooldowns(expires_at);
```

---

## FACTIONS & TERRITORIES

### factions
```sql
CREATE TABLE factions (
    faction_id SERIAL PRIMARY KEY,
    faction_name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    color_hex VARCHAR(7),
    motto VARCHAR(200),
    
    total_members INTEGER DEFAULT 0,
    territories_controlled INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### territories
```sql
CREATE TABLE territories (
    territory_id SERIAL PRIMARY KEY,
    territory_name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    
    controlling_faction_id INTEGER REFERENCES factions(faction_id),
    is_contested BOOLEAN DEFAULT FALSE,
    
    buff_type VARCHAR(50),
    buff_value INTEGER,
    
    last_evaluated_at TIMESTAMP,
    control_changed_at TIMESTAMP
);

CREATE INDEX idx_territories_faction ON territories(controlling_faction_id);
```

### territory_scores
```sql
CREATE TABLE territory_scores (
    score_id SERIAL PRIMARY KEY,
    territory_id INTEGER REFERENCES territories(territory_id),
    faction_id INTEGER REFERENCES factions(faction_id),
    
    score_date DATE NOT NULL,
    total_score BIGINT DEFAULT 0,
    
    messages INTEGER DEFAULT 0,
    plays INTEGER DEFAULT 0,
    robs INTEGER DEFAULT 0,
    missions INTEGER DEFAULT 0,
    checkins INTEGER DEFAULT 0,
    
    UNIQUE(territory_id, faction_id, score_date)
);

CREATE INDEX idx_scores_date ON territory_scores(score_date);
```

### user_territory_assignments
```sql
CREATE TABLE user_territory_assignments (
    assignment_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id),
    territory_id INTEGER REFERENCES territories(territory_id),
    
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by INTEGER REFERENCES users(user_id)
);

CREATE INDEX idx_assignments_user ON user_territory_assignments(user_id);
```

---

## ACHIEVEMENTS & TITLES

### achievements
```sql
CREATE TABLE achievements (
    achievement_id SERIAL PRIMARY KEY,
    achievement_name VARCHAR(200) NOT NULL UNIQUE,
    achievement_key VARCHAR(100) NOT NULL UNIQUE,
    description TEXT NOT NULL,
    
    category VARCHAR(50) NOT NULL,
    tier VARCHAR(50) NOT NULL,
    
    requirement_type VARCHAR(50) NOT NULL,
    requirement_value BIGINT NOT NULL,
    
    reward_wealth INTEGER DEFAULT 0,
    reward_xp INTEGER DEFAULT 0,
    reward_title VARCHAR(100),
    reward_item_id INTEGER REFERENCES items(item_id),
    
    icon_url VARCHAR(500),
    is_hidden BOOLEAN DEFAULT FALSE,
    display_order INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_achievements_category ON achievements(category);
```

### user_achievements
```sql
CREATE TABLE user_achievements (
    user_achievement_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    achievement_id INTEGER REFERENCES achievements(achievement_id),
    
    current_progress BIGINT DEFAULT 0,
    is_completed BOOLEAN DEFAULT FALSE,
    
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, achievement_id)
);

CREATE INDEX idx_user_achievements_user ON user_achievements(user_id);
CREATE INDEX idx_user_achievements_completed ON user_achievements(user_id, is_completed);
```

### user_titles
```sql
CREATE TABLE user_titles (
    user_title_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    title VARCHAR(100) NOT NULL,
    is_equipped BOOLEAN DEFAULT FALSE,
    unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, title)
);

CREATE INDEX idx_user_titles_user ON user_titles(user_id);
CREATE INDEX idx_user_titles_equipped ON user_titles(user_id, is_equipped);
```

---

## LEADERBOARDS

### leaderboard_snapshots
```sql
CREATE TABLE leaderboard_snapshots (
    snapshot_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    period_type VARCHAR(20) NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    wealth_earned BIGINT DEFAULT 0,
    xp_earned BIGINT DEFAULT 0,
    messages_sent INTEGER DEFAULT 0,
    watch_time_minutes INTEGER DEFAULT 0,
    play_count INTEGER DEFAULT 0,
    rob_count INTEGER DEFAULT 0,
    rob_success_count INTEGER DEFAULT 0,
    checkins INTEGER DEFAULT 0,
    crates_opened INTEGER DEFAULT 0,
    
    subs_count INTEGER DEFAULT 0,
    gift_subs_given INTEGER DEFAULT 0,
    bits_donated INTEGER DEFAULT 0,
    kicks_sent INTEGER DEFAULT 0,
    donations_usd DECIMAL(10,2) DEFAULT 0,
    total_contributed_usd DECIMAL(10,2) DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, period_type, period_start)
);

CREATE INDEX idx_snapshots_period ON leaderboard_snapshots(period_type, period_start);
CREATE INDEX idx_snapshots_wealth ON leaderboard_snapshots(period_type, period_start, wealth_earned DESC);
CREATE INDEX idx_snapshots_contributions ON leaderboard_snapshots(period_type, period_start, total_contributed_usd DESC);
```

### hall_of_fame_records
```sql
CREATE TABLE hall_of_fame_records (
    record_id SERIAL PRIMARY KEY,
    record_type VARCHAR(50) NOT NULL UNIQUE,
    user_id INTEGER REFERENCES users(user_id),
    record_value BIGINT NOT NULL,
    achieved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    previous_holder_id INTEGER,
    previous_value BIGINT
);
```

---

## MISSIONS

### mission_templates
```sql
CREATE TABLE mission_templates (
    template_id VARCHAR(20) PRIMARY KEY,
    mission_type VARCHAR(10) NOT NULL,
    category VARCHAR(20) NOT NULL,
    difficulty VARCHAR(10) NOT NULL,
    
    name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    
    objective_type VARCHAR(50) NOT NULL,
    objective_base_value INTEGER NOT NULL,
    
    is_luck_based BOOLEAN DEFAULT FALSE,
    requires_item VARCHAR(50),
    
    reward_wealth INTEGER NOT NULL,
    reward_xp INTEGER NOT NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### user_missions
```sql
CREATE TABLE user_missions (
    user_mission_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    template_id VARCHAR(20) REFERENCES mission_templates(template_id),
    
    mission_type VARCHAR(10) NOT NULL,
    assigned_tier VARCHAR(20) NOT NULL,
    tier_multiplier DECIMAL(3,2) NOT NULL,
    
    objective_value INTEGER NOT NULL,
    reward_wealth INTEGER NOT NULL,
    reward_xp INTEGER NOT NULL,
    
    current_progress INTEGER DEFAULT 0,
    is_completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP,
    
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    
    status VARCHAR(20) DEFAULT 'active'
);

CREATE INDEX idx_user_missions_user ON user_missions(user_id);
CREATE INDEX idx_user_missions_status ON user_missions(status, expires_at);
```

### mission_completions
```sql
CREATE TABLE mission_completions (
    completion_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    
    completion_type VARCHAR(10) NOT NULL,
    completed_date DATE NOT NULL,
    
    mission_ids INTEGER[] NOT NULL,
    
    total_wealth INTEGER NOT NULL,
    total_xp INTEGER NOT NULL,
    bonus_wealth INTEGER NOT NULL,
    bonus_xp INTEGER NOT NULL,
    crate_awarded VARCHAR(20),
    
    player_tier VARCHAR(20) NOT NULL,
    
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_mission_completions_user ON mission_completions(user_id);
CREATE INDEX idx_mission_completions_date ON mission_completions(completed_date);
```

---

## JUICERNAUT & MONETIZATION

### streaming_sessions
```sql
CREATE TABLE streaming_sessions (
    session_id SERIAL PRIMARY KEY,
    session_title VARCHAR(255),
    platform VARCHAR(20) NOT NULL,
    
    is_active BOOLEAN DEFAULT TRUE,
    current_juicernaut_user_id INTEGER REFERENCES users(user_id),
    
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    
    total_contributions_usd DECIMAL(10,2) DEFAULT 0,
    total_viewers_peak INTEGER DEFAULT 0,
    total_messages INTEGER DEFAULT 0
);

CREATE INDEX idx_sessions_active ON streaming_sessions(is_active);
```

### session_contributions
```sql
CREATE TABLE session_contributions (
    contribution_id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES streaming_sessions(session_id),
    user_id INTEGER REFERENCES users(user_id),
    
    platform VARCHAR(20) NOT NULL,
    contribution_type VARCHAR(50) NOT NULL,
    quantity INTEGER DEFAULT 1,
    usd_value DECIMAL(10,2) NOT NULL,
    
    monetization_event_id INTEGER REFERENCES monetization_events(event_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_contributions_session ON session_contributions(session_id);
CREATE INDEX idx_contributions_user ON session_contributions(session_id, user_id);
```

### juicernaut_winners
```sql
CREATE TABLE juicernaut_winners (
    winner_id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES streaming_sessions(session_id),
    user_id INTEGER REFERENCES users(user_id),
    
    total_contributed_usd DECIMAL(10,2) NOT NULL,
    contributions_count INTEGER NOT NULL,
    time_held_minutes INTEGER,
    
    reward_wealth BIGINT,
    reward_xp INTEGER,
    bonus_crate_tier VARCHAR(50),
    
    won_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### juicernaut_crown_changes
```sql
CREATE TABLE juicernaut_crown_changes (
    change_id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES streaming_sessions(session_id),
    
    previous_juicernaut_user_id INTEGER REFERENCES users(user_id),
    new_juicernaut_user_id INTEGER REFERENCES users(user_id),
    
    new_total_usd DECIMAL(10,2),
    
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### monetization_events
```sql
CREATE TABLE monetization_events (
    event_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id),
    
    platform VARCHAR(20) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    
    quantity INTEGER DEFAULT 1,
    amount_usd DECIMAL(10,2),
    tier VARCHAR(20),
    
    recipient_user_id INTEGER REFERENCES users(user_id),
    recipient_username VARCHAR(100),
    
    wealth_rewarded BIGINT NOT NULL DEFAULT 0,
    xp_rewarded INTEGER NOT NULL DEFAULT 0,
    
    raw_event_data JSONB,
    external_event_id VARCHAR(255) UNIQUE,
    
    processed BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_monetization_user ON monetization_events(user_id);
CREATE INDEX idx_monetization_platform ON monetization_events(platform);
CREATE INDEX idx_monetization_external ON monetization_events(external_event_id);
```

### reward_config
```sql
CREATE TABLE reward_config (
    config_id SERIAL PRIMARY KEY,
    platform VARCHAR(20) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    
    wealth_per_unit INTEGER NOT NULL,
    xp_per_unit INTEGER NOT NULL,
    tier_multiplier JSONB,
    
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(platform, event_type)
);
```

---

## BUFFS

### active_buffs
```sql
CREATE TABLE active_buffs (
    buff_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id),
    buff_type VARCHAR(50) NOT NULL,
    
    multiplier DECIMAL(5,2),
    description TEXT,
    
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP,
    activated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, buff_type)
);

CREATE INDEX idx_buffs_user ON active_buffs(user_id, is_active);
CREATE INDEX idx_buffs_expires ON active_buffs(expires_at);
```

---

## BLACK MARKET

### black_market_inventory
```sql
CREATE TABLE black_market_inventory (
    market_id SERIAL PRIMARY KEY,
    item_id INTEGER REFERENCES items(item_id),
    
    stock_quantity INTEGER NOT NULL,
    original_stock INTEGER NOT NULL,
    price INTEGER NOT NULL,
    
    rotation_id INTEGER NOT NULL,
    available_from TIMESTAMP NOT NULL,
    available_until TIMESTAMP NOT NULL,
    
    is_featured BOOLEAN DEFAULT FALSE,
    discount_percent INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_market_rotation ON black_market_inventory(rotation_id);
CREATE INDEX idx_market_available ON black_market_inventory(available_from, available_until);
```

### black_market_purchases
```sql
CREATE TABLE black_market_purchases (
    purchase_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id),
    market_id INTEGER REFERENCES black_market_inventory(market_id),
    item_id INTEGER REFERENCES items(item_id),
    price_paid INTEGER NOT NULL,
    purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## PLAYER SHOP

### player_shop_inventory
```sql
-- Each player has their own unique shop inventory
CREATE TABLE player_shop_inventory (
    shop_item_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    item_id INTEGER REFERENCES items(item_id),
    
    price INTEGER NOT NULL,
    
    -- When this shop was generated
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Optional: track if purchased (or just delete row on purchase)
    is_purchased BOOLEAN DEFAULT FALSE,
    purchased_at TIMESTAMP
);

CREATE INDEX idx_player_shop_user ON player_shop_inventory(user_id);
CREATE INDEX idx_player_shop_available ON player_shop_inventory(user_id, is_purchased);
```

### Player Shop Generation Logic
```sql
-- When generating a player's shop, delete old items first
DELETE FROM player_shop_inventory WHERE user_id = $1;

-- Then insert 6-10 new items based on player tier
INSERT INTO player_shop_inventory (user_id, item_id, price)
SELECT $1, item_id, purchase_price
FROM items
WHERE tier IN (/* tiers available to player */)
ORDER BY RANDOM()
LIMIT 8; -- or random between 6-10
```

---

## HEIST ALERTS

### heist_events
```sql
CREATE TABLE heist_events (
    heist_id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES streaming_sessions(session_id),
    
    event_type VARCHAR(20) NOT NULL,
    difficulty VARCHAR(10) NOT NULL,
    prompt TEXT NOT NULL,
    correct_answer VARCHAR(200) NOT NULL,
    
    started_at TIMESTAMP NOT NULL,
    time_limit_seconds INTEGER NOT NULL,
    ended_at TIMESTAMP,
    
    winner_user_id INTEGER REFERENCES users(user_id),
    winner_platform VARCHAR(20),
    winning_answer VARCHAR(200),
    response_time_ms INTEGER,
    
    crate_tier VARCHAR(20),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_heist_session ON heist_events(session_id);
```

### heist_schedule
```sql
CREATE TABLE heist_schedule (
    schedule_id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES streaming_sessions(session_id),
    next_heist_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### heist_trivia_pool
```sql
CREATE TABLE heist_trivia_pool (
    trivia_id SERIAL PRIMARY KEY,
    category VARCHAR(50) NOT NULL,
    question TEXT NOT NULL,
    answer VARCHAR(200) NOT NULL,
    times_used INTEGER DEFAULT 0,
    last_used_at TIMESTAMP
);
```

### heist_recent_events
```sql
CREATE TABLE heist_recent_events (
    recent_id SERIAL PRIMARY KEY,
    event_type VARCHAR(20) NOT NULL,
    content_id INTEGER NOT NULL,
    used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_heist_recent ON heist_recent_events(used_at);
```

---

## COMMUNICATIONS

### user_notifications
```sql
CREATE TABLE user_notifications (
    notification_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL,
    
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    icon VARCHAR(50),
    
    link_type VARCHAR(50),
    link_id VARCHAR(100),
    
    is_seen BOOLEAN DEFAULT FALSE,
    seen_at TIMESTAMP,
    is_dismissed BOOLEAN DEFAULT FALSE,
    dismissed_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

CREATE INDEX idx_notifications_user ON user_notifications(user_id);
CREATE INDEX idx_notifications_unseen ON user_notifications(user_id, is_seen);
```

### event_batch_queue
```sql
CREATE TABLE event_batch_queue (
    queue_id SERIAL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    platform VARCHAR(20) NOT NULL,
    payload JSONB NOT NULL,
    batch_key VARCHAR(100) NOT NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    process_after TIMESTAMP NOT NULL
);

CREATE INDEX idx_batch_queue_process ON event_batch_queue(process_after);
```

### discord_server_config
```sql
CREATE TABLE discord_server_config (
    config_id SERIAL PRIMARY KEY,
    discord_guild_id VARCHAR(50) NOT NULL UNIQUE,
    commands_channel_id VARCHAR(50),
    feed_channel_id VARCHAR(50),
    admin_webhook_url TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### discord_activity_channels
```sql
CREATE TABLE discord_activity_channels (
    channel_id SERIAL PRIMARY KEY,
    discord_guild_id VARCHAR(50) NOT NULL,
    discord_channel_id VARCHAR(50) NOT NULL,
    added_by_discord_user_id VARCHAR(50),
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(discord_guild_id, discord_channel_id)
);
```

---

## CONFIGURATION

### bot_config
```sql
CREATE TABLE bot_config (
    config_key VARCHAR(100) PRIMARY KEY,
    config_value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

**END OF DOCUMENT**
