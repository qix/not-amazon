{
  description = "Develop Python on Nix with uv and postgres";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-25.11";
  };

  outputs = { nixpkgs, ... }:
    let
      inherit (nixpkgs) lib;
      forAllSystems = lib.genAttrs lib.systems.flakeExposed;
    in
    {
      devShells = forAllSystems (
        system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
          # Define the libraries psycopg2 needs at build and runtime
          deps = with pkgs; [
            openssl     # Dependency of postgresql/psycopg2
            zlib        # Dependency of postgresql/psycopg2
            libxml2     # Often needed for postgres dev
            libiconv    # Needed on some architectures/mac
          ];
        in
        {
          default = pkgs.mkShell {
            packages = [
              pkgs.python3
	      pkgs.railway
              pkgs.uv
              pkgs.curl
              pkgs.nodejs_24
            ] ++ deps;

            # This is the "magic" for NixOS. 
            # It allows the compiled psycopg2 binary to find libpq.so at runtime.
            LD_LIBRARY_PATH = lib.makeLibraryPath deps;

            shellHook = ''
              unset PYTHONPATH
              # uv sync
              # Ensure the venv is activated
              if [ -d .venv ]; then
                source .venv/bin/activate
              fi
            '';
          };
        }
      );
    };
}
