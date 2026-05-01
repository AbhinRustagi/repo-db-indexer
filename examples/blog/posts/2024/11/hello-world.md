---
title: Hello, World
slug: hello-world
date: "2024-11-15"
description: An obligatory first post that demonstrates how repo-db-indexer treats a single content type.
tags:
  - meta
  - intro
canonical_url: https://example.com/blog/hello-world
reading_time: 1
published: true
---

This is the body of the post. It can contain any Markdown — repo-db-indexer
preserves it on disk and only reads the YAML frontmatter to build the index.

The body never appears in `index.json` (because it's not in the projection),
but it does show up in `llms.txt` if you've configured a `description`.
