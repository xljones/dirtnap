# ── PythonAnywhere deployment ────────────────────────────────────────────────
# Run from a PythonAnywhere Bash console inside ~/dirtnap

.PHONY: deploy-pa
# prompt for a db backup, pull latest deploy branch (includes built dist/), create venv if needed, install deps
deploy-pa:
	@if [ -f data/samples.db ]; then \
		while true; do \
			printf 'Back up the database before deploying? Type "yes" or "no": '; \
			read -r answer || { echo; echo "No input received, aborting deploy."; exit 1; }; \
			case "$$answer" in \
				yes) python3 backend-src/manage.py db-backup || exit 1; break ;; \
				no)  echo "Skipping database backup."; break ;; \
				*)   echo 'Please type "yes" or "no".' ;; \
			esac; \
		done; \
	fi
	git fetch origin && git checkout deploy && git reset --hard origin/deploy
	[ -d venv ] || python3 -m venv venv
	venv/bin/pip install -r requirements.txt
	@python3 scripts/deploy_summary.py
