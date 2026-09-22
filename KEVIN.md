# KEVIN.md

- Edit this scratchpad only on master. Public repository: no private traffic metrics or credentials here.
- Sept22 source inspection: action.yml ship_post sends Content-Type and optional Authorization, but no X-Ship-Source. Action deploys cannot be distinguished from generic API traffic by that header. Attribution change was not requested; no runtime changes made.
