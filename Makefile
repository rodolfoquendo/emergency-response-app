.PHONY: install prebuild prebuild-clean prebuild-sync ios android start dev \
        pods type-check lint clean reset build-ios build-android

MOBILE := apps/mobile

# ── Dependencies ─────────────────────────────────────────────────────────────

install:
	@yarn install

# ── Native codegen ───────────────────────────────────────────────────────────

prebuild: install
	@cd $(MOBILE) && npx expo prebuild

prebuild-clean: reset
	@cd $(MOBILE) && npx expo prebuild --clean

# Re-run prebuild after adding new native deps (skips full reset)
prebuild-sync: install
	@cd $(MOBILE) && npx expo prebuild

pods:
	@command -v pod >/dev/null 2>&1 || { echo "CocoaPods not found. Run: brew install cocoapods"; exit 1; }
	@cd $(MOBILE)/ios && pod install

# ── Run locally ──────────────────────────────────────────────────────────────

ios: pods
	@cd $(MOBILE) && npx expo run:ios

android:
	@cd $(MOBILE) && npx expo run:android

start:
	@cd $(MOBILE) && npx expo start

dev:
	@yarn dev

# ── EAS cloud builds ─────────────────────────────────────────────────────────

build-ios:
	@cd $(MOBILE) && npx eas build --platform ios

build-android:
	@cd $(MOBILE) && npx eas build --platform android

# ── Quality ──────────────────────────────────────────────────────────────────

type-check:
	@yarn turbo run type-check

lint:
	@yarn turbo run lint

# ── Cleanup ──────────────────────────────────────────────────────────────────

clean:
	@yarn turbo run clean
	@rm -rf $(MOBILE)/ios $(MOBILE)/android $(MOBILE)/.expo

reset: clean
	@rm -rf node_modules apps/*/node_modules packages/*/node_modules
	@yarn install
