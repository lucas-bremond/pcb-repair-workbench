# The scenario viewer, with Docker.
#   make build   build the image: the app and its server (Node.js and Python)
#   make start   serve it at http://localhost:$(PORT) (builds the image first if missing), with
#                the scenarios in $(SCENARIOS) (default: scenarios/), editable
#   make stop    stop it
#   make dev     live reload at http://localhost:$(DEV_PORT): edits to app/web/src show at once,
#                and the server restarts when app/server changes (Ctrl-C to stop)
#   make check SCENARIO=path   validate a scenario folder and regenerate its outputs

IMAGE     ?= homestar-flux-app
CONTAINER ?= homestar-flux-app
PORT      ?= 8080
DEV_PORT  ?= 5173
SCENARIOS ?= $(CURDIR)/scenarios

SCENARIOS_ABS := $(abspath $(SCENARIOS))

.PHONY: build start stop dev check

build:
	docker build -f app/Dockerfile -t $(IMAGE) .

start:
	@mkdir -p "$(SCENARIOS_ABS)"
	@docker image inspect $(IMAGE) >/dev/null 2>&1 || $(MAKE) --no-print-directory build
	@docker rm -f $(CONTAINER) >/dev/null 2>&1 || true
	@docker run -d --rm --name $(CONTAINER) -p 127.0.0.1:$(PORT):8080 --user "$$(id -u):$$(id -g)" \
		-v "$(SCENARIOS_ABS)":/data/scenarios $(IMAGE) >/dev/null
	@echo "Viewer running at http://localhost:$(PORT) (make stop to stop it)"
	@echo "  scenarios: $(SCENARIOS_ABS)"

stop:
	@docker rm -f $(CONTAINER) >/dev/null 2>&1 && echo "Stopped $(CONTAINER)" || echo "$(CONTAINER) is not running"

dev:
	@mkdir -p "$(SCENARIOS_ABS)"
	docker build -f app/Dockerfile --target dev -t $(IMAGE)-dev .
	@docker rm -f $(CONTAINER)-dev >/dev/null 2>&1 || true
	@echo "Live reload at http://localhost:$(DEV_PORT) once Vite is ready (Ctrl-C to stop)"
	docker run --rm $(shell [ -t 0 ] && echo -it) --init --name $(CONTAINER)-dev -p 127.0.0.1:$(DEV_PORT):5173 \
		-v "$(CURDIR)":/src -v /src/app/web/node_modules -v "$(SCENARIOS_ABS)":/data/scenarios \
		-e SCENARIO_ROOTS=scenarios=/data/scenarios $(IMAGE)-dev

check:
	@test -n "$(SCENARIO)" || { echo "usage: make check SCENARIO=path/to/scenario-folder"; exit 2; }
	@docker image inspect $(IMAGE) >/dev/null 2>&1 || $(MAKE) --no-print-directory build
	@docker run --rm --user "$$(id -u):$$(id -g)" -v "$(abspath $(SCENARIO))":/data/s $(IMAGE) python -I scripts/build.py /data/s
