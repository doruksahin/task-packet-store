# Changelog

## [0.1.2](https://github.com/doruksahin/task-packet-store/compare/v0.1.1...v0.1.2) (2026-09-06)


### Miscellaneous Chores

* **release:** request 0.1.2 ([#18](https://github.com/doruksahin/task-packet-store/issues/18)) ([476f11b](https://github.com/doruksahin/task-packet-store/commit/476f11be6cbfc626827865e1266dc70581e647ce))

## [0.1.1](https://github.com/doruksahin/task-packet-store/compare/v0.1.0...v0.1.1) (2026-09-05)


### Bug Fixes

* **fs:** safely replace read-only checkpoint and pull files ([#12](https://github.com/doruksahin/task-packet-store/issues/12)) ([a00a679](https://github.com/doruksahin/task-packet-store/commit/a00a679d36d4f88105128fd63f248c630778d536))

## 0.1.0 (2026-09-05)


### Features

* add anchored glob matcher for fs filters ([c288490](https://github.com/doruksahin/task-packet-store/commit/c288490163acec4cb0d6cd30560436dcc6b1bafb))
* add PacketTransport and the fs transport ([2709980](https://github.com/doruksahin/task-packet-store/commit/2709980d843e817e2f194dbed225696e54b2a793))
* add run.md, snapshot, and state schemas ([2ddb9d8](https://github.com/doruksahin/task-packet-store/commit/2ddb9d8956564eb02718aa6e2505c140f60340f0))
* add store config schema and error codes ([43024c2](https://github.com/doruksahin/task-packet-store/commit/43024c2991bcbf1a0a17fc78eee9a9bf73822f57))
* add the rclone transport for Google Drive ([57facdd](https://github.com/doruksahin/task-packet-store/commit/57facddb47d5880b94b6295b9461b216b6d04ac6))
* begin, checkpoint, and pull stage runs ([48fdd7e](https://github.com/doruksahin/task-packet-store/commit/48fdd7e363dd58e0322bcf0e44aa1081c072feca))
* digest packet identity over the identity zone only ([a7f261b](https://github.com/doruksahin/task-packet-store/commit/a7f261beaadff8d2342d93a45e4e5f9784101442))
* expose fetch and push on the CLI ([a925017](https://github.com/doruksahin/task-packet-store/commit/a9250172d9e2bf28990e876f8f93b192cf196680))
* expose lightweight identity imports and verify installed commands ([#6](https://github.com/doruksahin/task-packet-store/issues/6)) ([34448e5](https://github.com/doruksahin/task-packet-store/commit/34448e512b56a112521d8ac49f9edf413cf95ec5))
* fetch and push packets through a transport ([612b598](https://github.com/doruksahin/task-packet-store/commit/612b59837e95a8103d0927335d595871cd97dc10))
* locate existing packet results without changing access ([#2](https://github.com/doruksahin/task-packet-store/issues/2)) ([bc2744a](https://github.com/doruksahin/task-packet-store/commit/bc2744a1596fc0a2d08577ddeb3167d63fbe1152))
* wire begin, checkpoint, pull, and doctor on the CLI ([ef522b9](https://github.com/doruksahin/task-packet-store/commit/ef522b998cebd126d0aedefa54cf81579f8e1ea1))


### Bug Fixes

* **ci:** avoid rclone environment flag collision ([#1](https://github.com/doruksahin/task-packet-store/issues/1)) ([9c07cf9](https://github.com/doruksahin/task-packet-store/commit/9c07cf9808aede816d5a05b4b7ed12fc99e76456))
* enforce step 05 safety invariants ([1de0e6f](https://github.com/doruksahin/task-packet-store/commit/1de0e6f3d3db5baeafb6773c89912f7e4fe14b21))
* exit 2 on usage errors and test the CLI contract ([d778f32](https://github.com/doruksahin/task-packet-store/commit/d778f32cc26446cbc52b2495682f0f6f731f1a87))
* finish step 04 hardening coverage ([d5a77c1](https://github.com/doruksahin/task-packet-store/commit/d5a77c1772eeb4a3774316718c16cd48c5637592))
* make TransferFilter a union, ignore .DS_Store, and improve failure messages ([161a56d](https://github.com/doruksahin/task-packet-store/commit/161a56d80872b2668055b86863099f5ade0fdb2b))
* move the same-path guard into FsTransport and drop driver branches from operations ([fc915d2](https://github.com/doruksahin/task-packet-store/commit/fc915d2e95a03e955bb96c62b303eabd08e838cc))
* **release:** allow trusted publishing from private repositories ([#5](https://github.com/doruksahin/task-packet-store/issues/5)) ([165155a](https://github.com/doruksahin/task-packet-store/commit/165155a07a003d7217c1af695b79e7a833f0b8b6))
* tighten identity and prefix schemas and validate transport segments ([cd3ae01](https://github.com/doruksahin/task-packet-store/commit/cd3ae01885f53cf78b89d87a7dfeda3a0c2c527d))
