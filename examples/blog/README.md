# Example Blog

A small content repository that uses `repo-db-indexer` to maintain
`index.json`, `llms.txt`, and the generated section of this README.

The hand-written intro you're reading is preserved on every build because
the indexer only rewrites the section between the markers below.

<!-- repo-db-indexer:start -->

## post

- [Hello, World](posts/2024/11/hello-world.md)
- [Spring Update](posts/2024/03/spring-update.md)
- [An Older Post](posts/2023/09/older-post.md)

<!-- repo-db-indexer:end -->

## Notes

Edit the marker block above by adding posts under `posts/<year>/<month>/`
and running `repo-db-indexer build` from this directory.
