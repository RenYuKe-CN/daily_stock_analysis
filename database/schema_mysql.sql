-- DSA Stock Analysis System - MySQL Schema (with multi-user isolation)
-- Usage: mysql -u root -p < schema_mysql.sql

CREATE DATABASE IF NOT EXISTS dsa CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE dsa;

-- Table: fundamental_snapshot
CREATE TABLE fundamental_snapshot (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	query_id VARCHAR(64) NOT NULL, 
	code VARCHAR(10) NOT NULL, 
	payload TEXT NOT NULL, 
	source_chain TEXT, 
	coverage TEXT, 
	created_at DATETIME, 
	PRIMARY KEY (id)
);

-- Table: news_intel
CREATE TABLE news_intel (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	query_id VARCHAR(64), 
	code VARCHAR(10) NOT NULL, 
	name VARCHAR(50), 
	dimension VARCHAR(32), 
	query VARCHAR(255), 
	provider VARCHAR(32), 
	title VARCHAR(300) NOT NULL, 
	snippet TEXT, 
	url VARCHAR(768) NOT NULL, 
	url_hash VARCHAR(64) NOT NULL, 
	source VARCHAR(100), 
	published_date DATETIME, 
	fetched_at DATETIME, 
	query_source VARCHAR(32), 
	requester_platform VARCHAR(20), 
	requester_user_id VARCHAR(64), 
	requester_user_name VARCHAR(64), 
	requester_chat_id VARCHAR(64), 
	requester_message_id VARCHAR(64), 
	requester_query VARCHAR(255), 
	PRIMARY KEY (id)
);

-- Table: portfolio_fx_rates
CREATE TABLE portfolio_fx_rates (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	from_currency VARCHAR(8) NOT NULL, 
	to_currency VARCHAR(8) NOT NULL, 
	rate_date DATE NOT NULL, 
	rate FLOAT NOT NULL, 
	source VARCHAR(32) NOT NULL, 
	is_stale BOOL NOT NULL, 
	updated_at DATETIME, 
	PRIMARY KEY (id), 
	CONSTRAINT uix_portfolio_fx_pair_date UNIQUE (from_currency, to_currency, rate_date)
);

-- Table: stock_daily
CREATE TABLE stock_daily (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	code VARCHAR(10) NOT NULL, 
	date DATE NOT NULL, 
	open FLOAT, 
	high FLOAT, 
	low FLOAT, 
	close FLOAT, 
	volume FLOAT, 
	amount FLOAT, 
	pct_chg FLOAT, 
	ma5 FLOAT, 
	ma10 FLOAT, 
	ma20 FLOAT, 
	volume_ratio FLOAT, 
	data_source VARCHAR(50), 
	created_at DATETIME, 
	updated_at DATETIME, 
	PRIMARY KEY (id), 
	CONSTRAINT uix_code_date UNIQUE (code, date)
);

-- Table: users
CREATE TABLE users (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	username VARCHAR(64) NOT NULL, 
	password_hash VARCHAR(255) NOT NULL, 
	email VARCHAR(128), 
	`role` VARCHAR(16) NOT NULL, 
	is_active BOOL NOT NULL, 
	created_at DATETIME, 
	updated_at DATETIME, 
	PRIMARY KEY (id)
);

-- Table: agent_provider_turns
CREATE TABLE agent_provider_turns (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	user_id INTEGER, 
	session_id VARCHAR(100) NOT NULL, 
	run_id VARCHAR(64) NOT NULL, 
	provider VARCHAR(64) NOT NULL, 
	model VARCHAR(160) NOT NULL, 
	anchor_user_message_id INTEGER NOT NULL, 
	anchor_assistant_message_id INTEGER NOT NULL, 
	messages_json TEXT NOT NULL, 
	contains_reasoning BOOL NOT NULL, 
	contains_tool_calls BOOL NOT NULL, 
	contains_thinking_blocks BOOL NOT NULL, 
	must_roundtrip BOOL NOT NULL, 
	estimated_tokens INTEGER NOT NULL, 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id)
);

-- Table: alert_cooldowns
CREATE TABLE alert_cooldowns (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	user_id INTEGER, 
	rule_id INTEGER, 
	rule_key VARCHAR(255), 
	target VARCHAR(64) NOT NULL, 
	severity VARCHAR(16) NOT NULL, 
	last_triggered_at DATETIME, 
	cooldown_until DATETIME, 
	reason TEXT, 
	state VARCHAR(16) NOT NULL, 
	updated_at DATETIME, 
	PRIMARY KEY (id), 
	CONSTRAINT uix_alert_cooldown_rule_target_severity UNIQUE (rule_id, target, severity), 
	FOREIGN KEY(user_id) REFERENCES users (id)
);

-- Table: alert_notifications
CREATE TABLE alert_notifications (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	user_id INTEGER, 
	trigger_id INTEGER, 
	channel VARCHAR(32) NOT NULL, 
	attempt INTEGER NOT NULL, 
	success BOOL NOT NULL, 
	error_code VARCHAR(64), 
	retryable BOOL NOT NULL, 
	latency_ms INTEGER, 
	diagnostics TEXT, 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id)
);

-- Table: alert_rules
CREATE TABLE alert_rules (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	user_id INTEGER, 
	name VARCHAR(64) NOT NULL, 
	target_scope VARCHAR(32) NOT NULL, 
	target VARCHAR(64) NOT NULL, 
	alert_type VARCHAR(32) NOT NULL, 
	parameters TEXT NOT NULL, 
	severity VARCHAR(16) NOT NULL, 
	enabled BOOL NOT NULL, 
	source VARCHAR(16) NOT NULL, 
	cooldown_policy TEXT, 
	notification_policy TEXT, 
	created_at DATETIME, 
	updated_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id)
);

-- Table: alert_triggers
CREATE TABLE alert_triggers (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	user_id INTEGER, 
	rule_id INTEGER, 
	target VARCHAR(64) NOT NULL, 
	observed_value FLOAT, 
	threshold FLOAT, 
	reason TEXT, 
	data_source VARCHAR(64), 
	data_timestamp DATETIME, 
	triggered_at DATETIME, 
	status VARCHAR(16) NOT NULL, 
	diagnostics TEXT, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id)
);

-- Table: analysis_history
CREATE TABLE analysis_history (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	user_id INTEGER, 
	query_id VARCHAR(64), 
	code VARCHAR(10) NOT NULL, 
	name VARCHAR(50), 
	report_type VARCHAR(16), 
	sentiment_score INTEGER, 
	operation_advice VARCHAR(20), 
	trend_prediction VARCHAR(50), 
	analysis_summary TEXT, 
	raw_result TEXT, 
	news_content TEXT, 
	context_snapshot TEXT, 
	ideal_buy FLOAT, 
	secondary_buy FLOAT, 
	stop_loss FLOAT, 
	take_profit FLOAT, 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id)
);

-- Table: backtest_summaries
CREATE TABLE backtest_summaries (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	user_id INTEGER, 
	scope VARCHAR(16) NOT NULL, 
	code VARCHAR(16), 
	eval_window_days INTEGER NOT NULL, 
	engine_version VARCHAR(16) NOT NULL, 
	computed_at DATETIME, 
	total_evaluations INTEGER, 
	completed_count INTEGER, 
	insufficient_count INTEGER, 
	long_count INTEGER, 
	cash_count INTEGER, 
	win_count INTEGER, 
	loss_count INTEGER, 
	neutral_count INTEGER, 
	direction_accuracy_pct FLOAT, 
	win_rate_pct FLOAT, 
	neutral_rate_pct FLOAT, 
	avg_stock_return_pct FLOAT, 
	avg_simulated_return_pct FLOAT, 
	stop_loss_trigger_rate FLOAT, 
	take_profit_trigger_rate FLOAT, 
	ambiguous_rate FLOAT, 
	avg_days_to_first_hit FLOAT, 
	advice_breakdown_json TEXT, 
	diagnostics_json TEXT, 
	PRIMARY KEY (id), 
	CONSTRAINT uix_backtest_summary_scope_code_window_version UNIQUE (scope, code, eval_window_days, engine_version), 
	FOREIGN KEY(user_id) REFERENCES users (id)
);

-- Table: conversation_messages
CREATE TABLE conversation_messages (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	user_id INTEGER, 
	session_id VARCHAR(100) NOT NULL, 
	`role` VARCHAR(20) NOT NULL, 
	content TEXT NOT NULL, 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id)
);

-- Table: conversation_summaries
CREATE TABLE conversation_summaries (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	user_id INTEGER, 
	session_id VARCHAR(100) NOT NULL, 
	summary TEXT NOT NULL, 
	covered_message_id INTEGER NOT NULL, 
	source_message_count INTEGER NOT NULL, 
	estimated_tokens INTEGER NOT NULL, 
	created_at DATETIME, 
	updated_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id)
);

-- Table: llm_usage
CREATE TABLE llm_usage (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	user_id INTEGER, 
	call_type VARCHAR(32) NOT NULL, 
	model VARCHAR(128) NOT NULL, 
	stock_code VARCHAR(16), 
	prompt_tokens INTEGER NOT NULL, 
	completion_tokens INTEGER NOT NULL, 
	total_tokens INTEGER NOT NULL, 
	called_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id)
);

-- Table: portfolio_accounts
CREATE TABLE portfolio_accounts (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	user_id INTEGER, 
	owner_id VARCHAR(64), 
	name VARCHAR(64) NOT NULL, 
	broker VARCHAR(64), 
	market VARCHAR(8) NOT NULL, 
	base_currency VARCHAR(8) NOT NULL, 
	is_active BOOL NOT NULL, 
	created_at DATETIME, 
	updated_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id)
);

-- Table: backtest_results
CREATE TABLE backtest_results (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	user_id INTEGER, 
	analysis_history_id INTEGER NOT NULL, 
	code VARCHAR(10) NOT NULL, 
	analysis_date DATE, 
	eval_window_days INTEGER NOT NULL, 
	engine_version VARCHAR(16) NOT NULL, 
	eval_status VARCHAR(16) NOT NULL, 
	evaluated_at DATETIME, 
	operation_advice VARCHAR(20), 
	position_recommendation VARCHAR(8), 
	start_price FLOAT, 
	end_close FLOAT, 
	max_high FLOAT, 
	min_low FLOAT, 
	stock_return_pct FLOAT, 
	direction_expected VARCHAR(16), 
	direction_correct BOOL, 
	outcome VARCHAR(16), 
	stop_loss FLOAT, 
	take_profit FLOAT, 
	hit_stop_loss BOOL, 
	hit_take_profit BOOL, 
	first_hit VARCHAR(16), 
	first_hit_date DATE, 
	first_hit_trading_days INTEGER, 
	simulated_entry_price FLOAT, 
	simulated_exit_price FLOAT, 
	simulated_exit_reason VARCHAR(24), 
	simulated_return_pct FLOAT, 
	PRIMARY KEY (id), 
	CONSTRAINT uix_backtest_analysis_window_version UNIQUE (analysis_history_id, eval_window_days, engine_version), 
	FOREIGN KEY(user_id) REFERENCES users (id), 
	FOREIGN KEY(analysis_history_id) REFERENCES analysis_history (id)
);

-- Table: portfolio_cash_ledger
CREATE TABLE portfolio_cash_ledger (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	account_id INTEGER NOT NULL, 
	event_date DATE NOT NULL, 
	direction VARCHAR(8) NOT NULL, 
	amount FLOAT NOT NULL, 
	currency VARCHAR(8) NOT NULL, 
	note VARCHAR(255), 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(account_id) REFERENCES portfolio_accounts (id)
);

-- Table: portfolio_corporate_actions
CREATE TABLE portfolio_corporate_actions (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	account_id INTEGER NOT NULL, 
	symbol VARCHAR(16) NOT NULL, 
	market VARCHAR(8) NOT NULL, 
	currency VARCHAR(8) NOT NULL, 
	effective_date DATE NOT NULL, 
	action_type VARCHAR(24) NOT NULL, 
	cash_dividend_per_share FLOAT, 
	split_ratio FLOAT, 
	note VARCHAR(255), 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(account_id) REFERENCES portfolio_accounts (id)
);

-- Table: portfolio_daily_snapshots
CREATE TABLE portfolio_daily_snapshots (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	account_id INTEGER NOT NULL, 
	snapshot_date DATE NOT NULL, 
	cost_method VARCHAR(8) NOT NULL, 
	base_currency VARCHAR(8) NOT NULL, 
	total_cash FLOAT NOT NULL, 
	total_market_value FLOAT NOT NULL, 
	total_equity FLOAT NOT NULL, 
	unrealized_pnl FLOAT NOT NULL, 
	realized_pnl FLOAT NOT NULL, 
	fee_total FLOAT NOT NULL, 
	tax_total FLOAT NOT NULL, 
	fx_stale BOOL NOT NULL, 
	payload TEXT, 
	created_at DATETIME, 
	updated_at DATETIME, 
	PRIMARY KEY (id), 
	CONSTRAINT uix_portfolio_snapshot_account_date_method UNIQUE (account_id, snapshot_date, cost_method), 
	FOREIGN KEY(account_id) REFERENCES portfolio_accounts (id)
);

-- Table: portfolio_positions
CREATE TABLE portfolio_positions (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	account_id INTEGER NOT NULL, 
	cost_method VARCHAR(8) NOT NULL, 
	symbol VARCHAR(16) NOT NULL, 
	market VARCHAR(8) NOT NULL, 
	currency VARCHAR(8) NOT NULL, 
	quantity FLOAT NOT NULL, 
	avg_cost FLOAT NOT NULL, 
	total_cost FLOAT NOT NULL, 
	last_price FLOAT NOT NULL, 
	market_value_base FLOAT NOT NULL, 
	unrealized_pnl_base FLOAT NOT NULL, 
	valuation_currency VARCHAR(8) NOT NULL, 
	updated_at DATETIME, 
	PRIMARY KEY (id), 
	CONSTRAINT uix_portfolio_position_account_symbol_market_currency UNIQUE (account_id, symbol, market, currency, cost_method), 
	FOREIGN KEY(account_id) REFERENCES portfolio_accounts (id)
);

-- Table: portfolio_trades
CREATE TABLE portfolio_trades (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	account_id INTEGER NOT NULL, 
	trade_uid VARCHAR(128), 
	symbol VARCHAR(16) NOT NULL, 
	market VARCHAR(8) NOT NULL, 
	currency VARCHAR(8) NOT NULL, 
	trade_date DATE NOT NULL, 
	side VARCHAR(8) NOT NULL, 
	quantity FLOAT NOT NULL, 
	price FLOAT NOT NULL, 
	fee FLOAT, 
	tax FLOAT, 
	note VARCHAR(255), 
	dedup_hash VARCHAR(64), 
	created_at DATETIME, 
	PRIMARY KEY (id), 
	CONSTRAINT uix_portfolio_trade_uid UNIQUE (account_id, trade_uid), 
	CONSTRAINT uix_portfolio_trade_dedup_hash UNIQUE (account_id, dedup_hash), 
	FOREIGN KEY(account_id) REFERENCES portfolio_accounts (id)
);

-- Table: portfolio_position_lots
CREATE TABLE portfolio_position_lots (
	id INTEGER NOT NULL AUTO_INCREMENT, 
	account_id INTEGER NOT NULL, 
	cost_method VARCHAR(8) NOT NULL, 
	symbol VARCHAR(16) NOT NULL, 
	market VARCHAR(8) NOT NULL, 
	currency VARCHAR(8) NOT NULL, 
	open_date DATE NOT NULL, 
	remaining_quantity FLOAT NOT NULL, 
	unit_cost FLOAT NOT NULL, 
	source_trade_id INTEGER, 
	updated_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(account_id) REFERENCES portfolio_accounts (id), 
	FOREIGN KEY(source_trade_id) REFERENCES portfolio_trades (id)
);

