import os
import sys
import tempfile
import subprocess
import argparse
import shutil
import logging
from pathlib import Path
from typing import Optional, Tuple
import git

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

def check_prerequisites() -> Tuple[bool, str]:
    """Check if all required system tools are available."""
    logger.debug("Checking prerequisites...")
    required_tools = {
        'make': 'GNU Make',
        'gcc': 'GCC compiler',
        'git': 'Git',
    }
    
    missing = []
    for tool, description in required_tools.items():
        logger.debug(f"Checking for {tool} ({description})...")
        if not shutil.which(tool):
            missing.append(f"{tool} ({description})")
    
    if missing:
        error_msg = f"Missing required tools: {', '.join(missing)}"
        logger.error(error_msg)
        return False, error_msg
    
    logger.info("All prerequisites met")
    return True, ""

def validate_commit_range(repo: git.Repo, commit_range: str) -> Tuple[bool, str]:
    """Validate that the commit expression is valid and exists in the repository."""
    logger.debug(f"Validating commit range: {commit_range}")
    try:
        # Try to get the commit(s) directly
        if '..' in commit_range:
            # Handle range format
            start_commit, end_commit = commit_range.split('..')
            logger.debug(f"Validating range from {start_commit} to {end_commit}")
            repo.commit(start_commit)
            repo.commit(end_commit)
        else:
            # Handle single commit or other git expressions
            logger.debug(f"Validating single commit: {commit_range}")
            repo.commit(commit_range)
        logger.info("Commit expression is valid")
        return True, ""
    except (ValueError, git.BadName) as e:
        error_msg = f"Invalid commit expression: {e}"
        logger.error(error_msg)
        return False, error_msg

def get_commits_to_process(repo: git.Repo, commit_range: str) -> list:
    """Get the list of commits to process based on the commit expression."""
    logger.debug(f"Getting commits to process for range: {commit_range}")
    try:
        if '..' in commit_range:
            # Handle range format
            commits = list(repo.iter_commits(commit_range))
            logger.info(f"Found {len(commits)} commits in range")
            for commit in commits:
                logger.debug(f"Commit: {commit.hexsha[:8]} - {commit.message.splitlines()[0]}")
            return commits
        else:
            # Handle single commit
            commit = repo.commit(commit_range)
            logger.info(f"Processing single commit: {commit.hexsha[:8]}")
            logger.debug(f"Commit message: {commit.message.splitlines()[0]}")
            return [commit]
    except (ValueError, git.BadName) as e:
        error_msg = f"Invalid commit expression: {e}"
        logger.error(error_msg)
        raise ValueError(error_msg)

def check_build_environment(repo_path: Path) -> Tuple[bool, str]:
    """Check if the build environment is properly set up."""
    logger.debug(f"Checking build environment in {repo_path}")
    # Check for configure script
    configure_script = repo_path / 'configure'
    if not configure_script.exists():
        error_msg = "Configure script not found. Is this a valid CPython repository?"
        logger.error(error_msg)
        return False, error_msg
    
    # Check if configure script is executable
    if not os.access(configure_script, os.X_OK):
        error_msg = "Configure script is not executable. Please run 'chmod +x configure' first."
        logger.error(error_msg)
        return False, error_msg
    
    logger.info("Build environment is valid")
    return True, ""

def check_output_directory(output_dir: Path) -> Tuple[bool, str]:
    """Check if the output directory is valid and writable."""
    logger.debug(f"Checking output directory: {output_dir}")
    try:
        output_dir.mkdir(parents=True, exist_ok=True)
        # Test write access
        test_file = output_dir / '.write_test'
        test_file.touch()
        test_file.unlink()
        logger.info(f"Output directory {output_dir} is valid and writable")
        return True, ""
    except (PermissionError, OSError) as e:
        error_msg = f"Cannot write to output directory: {e}"
        logger.error(error_msg)
        return False, error_msg

def process_commit(
    commit: git.Commit,
    repo_path: Path,
    output_dir: Path,
    configure_flags: str,
    make_flags: str,
    verbose: int,
) -> Optional[str]:
    """Process a single commit."""
    build_dir = None
    try:
        logger.info(f"Processing commit {commit.hexsha[:8]}")
        logger.debug(f"Commit message: {commit.message.splitlines()[0]}")
        
        # Checkout commit
        logger.info(f"Checking out commit {commit.hexsha[:8]}")
        repo = git.Repo(repo_path)
        repo.git.checkout(commit.hexsha)
        
        # Create unique directory for this run
        run_dir = output_dir / commit.hexsha
        run_dir.mkdir(exist_ok=True)
        logger.debug(f"Created run directory: {run_dir}")
        
        # Create temporary build directory
        build_dir = Path(tempfile.mkdtemp(prefix='cpython_build_'))
        logger.debug(f"Created build directory: {build_dir}")
        
        try:
            # Configure and build in the temporary directory
            logger.info(f"Running configure for commit {commit.hexsha[:8]}")
            logger.debug(f"Configure flags: {configure_flags}")
            
            configure_cmd = [
                str(repo_path / 'configure'),
                *configure_flags.split(),
                f'--prefix={build_dir}'
            ]
            logger.debug(f"Configure command: {' '.join(configure_cmd)}")
            
            result = subprocess.run(
                configure_cmd,
                cwd=build_dir,
                check=True,
                capture_output=verbose < 3
            )
            if verbose >= 3:
                if result.stdout:
                    print(result.stdout.decode() if isinstance(result.stdout, bytes) else result.stdout)
                if result.stderr:
                    print(result.stderr.decode() if isinstance(result.stderr, bytes) else result.stderr)
            else:
                if result.stdout:
                    logger.debug(f"Configure stdout:\n{result.stdout.decode() if isinstance(result.stdout, bytes) else result.stdout}")
                if result.stderr:
                    logger.debug(f"Configure stderr:\n{result.stderr.decode() if isinstance(result.stderr, bytes) else result.stderr}")
        
        except subprocess.CalledProcessError as e:
            error_msg = f"Error configuring commit {commit.hexsha}: {e}"
            if e.stdout:
                logger.error(f"Configure stdout:\n{e.stdout.decode() if isinstance(e.stdout, bytes) else e.stdout}")
            if e.stderr:
                logger.error(f"Configure stderr:\n{e.stderr.decode() if isinstance(e.stderr, bytes) else e.stderr}")
            return error_msg
        
        try:
            # Build Python
            logger.info(f"Running make for commit {commit.hexsha[:8]}")
            logger.debug(f"Make flags: {make_flags}")
            
            make_cmd = ['make', *make_flags.split()]
            logger.debug(f"Make command: {' '.join(make_cmd)}")
            
            result = subprocess.run(
                make_cmd,
                cwd=build_dir,
                check=True,
                capture_output=verbose < 3
            )
            if verbose >= 3:
                if result.stdout:
                    print(result.stdout.decode() if isinstance(result.stdout, bytes) else result.stdout)
                if result.stderr:
                    print(result.stderr.decode() if isinstance(result.stderr, bytes) else result.stderr)
            else:
                if result.stdout:
                    logger.debug(f"Make stdout:\n{result.stdout.decode() if isinstance(result.stdout, bytes) else result.stdout}")
                if result.stderr:
                    logger.debug(f"Make stderr:\n{result.stderr.decode() if isinstance(result.stderr, bytes) else result.stderr}")
            
            # Install Python
            logger.info(f"Running make install for commit {commit.hexsha[:8]}")
            
            result = subprocess.run(
                ['make', 'install'],
                cwd=build_dir,
                check=True,
                capture_output=verbose < 3
            )
            if verbose >= 3:
                if result.stdout:
                    print(result.stdout.decode() if isinstance(result.stdout, bytes) else result.stdout)
                if result.stderr:
                    print(result.stderr.decode() if isinstance(result.stderr, bytes) else result.stderr)
            else:
                if result.stdout:
                    logger.debug(f"Make install stdout:\n{result.stdout.decode() if isinstance(result.stdout, bytes) else result.stdout}")
                if result.stderr:
                    logger.debug(f"Make install stderr:\n{result.stderr.decode() if isinstance(result.stderr, bytes) else result.stderr}")
            
            # Create virtual environment
            logger.info(f"Creating virtual environment for commit {commit.hexsha[:8]}")
            venv_dir = Path(tempfile.mkdtemp(prefix='cpython_venv_'))
            logger.debug(f"Creating virtual environment in {venv_dir}")
            
            venv_cmd = [str(build_dir / 'bin' / 'python3'), '-m', 'venv', str(venv_dir)]
            logger.debug(f"Venv command: {' '.join(venv_cmd)}")
            
            result = subprocess.run(
                venv_cmd,
                check=True,
                capture_output=verbose < 3
            )
            if verbose >= 3:
                if result.stdout:
                    print(result.stdout.decode() if isinstance(result.stdout, bytes) else result.stdout)
                if result.stderr:
                    print(result.stderr.decode() if isinstance(result.stderr, bytes) else result.stderr)
            else:
                if result.stdout:
                    logger.debug(f"Venv stdout:\n{result.stdout.decode() if isinstance(result.stdout, bytes) else result.stdout}")
                if result.stderr:
                    logger.debug(f"Venv stderr:\n{result.stderr.decode() if isinstance(result.stderr, bytes) else result.stderr}")
            
            # Install memray
            logger.info(f"Installing memray for commit {commit.hexsha[:8]}")
            
            pip_cmd = [str(venv_dir / 'bin' / 'pip'), 'install', '-v', 'memray', '--no-cache-dir']
            logger.debug(f"Pip command: {' '.join(pip_cmd)}")
            
            result = subprocess.run(
                pip_cmd,
                check=True,
                capture_output=verbose < 3
            )
            if verbose >= 3:
                if result.stdout:
                    print(result.stdout.decode() if isinstance(result.stdout, bytes) else result.stdout)
                if result.stderr:
                    print(result.stderr.decode() if isinstance(result.stderr, bytes) else result.stderr)
            else:
                if result.stdout:
                    logger.debug(f"Pip stdout:\n{result.stdout.decode() if isinstance(result.stdout, bytes) else result.stdout}")
                if result.stderr:
                    logger.debug(f"Pip stderr:\n{result.stderr.decode() if isinstance(result.stderr, bytes) else result.stderr}")
            
            # Run benchmarks
            logger.info(f"Running benchmarks for commit {commit.hexsha[:8]}")
            from .benchmarks import run_benchmarks
            run_benchmarks(venv_dir, run_dir, commit)
            
            logger.info(f"Successfully completed processing commit {commit.hexsha[:8]}")
            return None
            
        except subprocess.CalledProcessError as e:
            error_msg = f"Error processing commit {commit.hexsha}: {e}"
            if e.stdout:
                logger.error(f"Command stdout:\n{e.stdout.decode() if isinstance(e.stdout, bytes) else e.stdout}")
            if e.stderr:
                logger.error(f"Command stderr:\n{e.stderr.decode() if isinstance(e.stderr, bytes) else e.stderr}")
            return error_msg
            
    except Exception as e:
        error_msg = f"Unexpected error processing commit {commit.hexsha}: {e}"
        logger.exception(error_msg)
        return error_msg
    finally:
        # Cleanup build directory after everything is done
        if build_dir and build_dir.exists():
            logger.debug(f"Cleaning up build directory: {build_dir}")
            try:
                shutil.rmtree(build_dir, ignore_errors=True)
            except Exception as e:
                logger.warning(f"Failed to clean up build directory {build_dir}: {e}")

def parse_args():
    """Parse command line arguments."""
    # Create a custom argument parser that handles quoted arguments correctly
    class CustomArgumentParser(argparse.ArgumentParser):
        def parse_args(self, args=None, namespace=None):
            # If args is None, use sys.argv[1:]
            if args is None:
                args = sys.argv[1:]
            
            # Remove the 'benchmark' command if present
            if args and args[0] == 'benchmark':
                args = args[1:]
            
            return super().parse_args(args, namespace)

    parser = CustomArgumentParser(
        description="Memory tracker for CPython commits",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Run benchmarks on last 5 commits
  memory-tracker benchmark HEAD~5..HEAD

  # Use custom CPython repository
  memory-tracker benchmark /path/to/cpython HEAD~5..HEAD

  # Custom build flags
  memory-tracker benchmark /path/to/cpython HEAD~5..HEAD --configure-flags="--enable-optimizations --with-lto" --make-flags="-j8"

  # Custom output directory
  memory-tracker benchmark /path/to/cpython HEAD~5..HEAD --output-dir="./my_benchmarks"

  # Verbose output
  memory-tracker benchmark HEAD~5..HEAD -v
  memory-tracker benchmark HEAD~5..HEAD -vv
  memory-tracker benchmark HEAD~5..HEAD -vvv
"""
    )
    
    parser.add_argument(
        'repo_path',
        nargs='?',
        type=Path,
        help='Path to CPython repository (optional, will clone if not provided)'
    )
    parser.add_argument(
        'commit_range',
        help='Git commit range to benchmark (e.g., HEAD~5..HEAD)'
    )
    parser.add_argument(
        '--output-dir', '-o',
        type=Path,
        default=Path('./benchmark_results'),
        help='Directory to store benchmark results (default: ./benchmark_results)'
    )
    parser.add_argument(
        '--configure-flags', '-c',
        default='--enable-optimizations',
        help='Configure flags for CPython build (default: --enable-optimizations)'
    )
    parser.add_argument(
        '--make-flags', '-m',
        default='-j4',
        help='Make flags for CPython build (default: -j4)'
    )
    parser.add_argument(
        '-v', '--verbose',
        action='count',
        default=0,
        help='Increase verbosity (can be used multiple times, e.g. -vvv)'
    )
    
    return parser.parse_args()

def main():
    """Main entry point."""
    args = parse_args()
    
    # Set up logging based on verbosity
    log_level = {
        0: logging.WARNING,
        1: logging.INFO,
        2: logging.DEBUG,
        3: logging.DEBUG,  # Even more verbose
    }.get(args.verbose, logging.DEBUG)
    
    logging.basicConfig(
        level=log_level,
        format='%(asctime)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    logger = logging.getLogger(__name__)
    
    # Check prerequisites
    logger.info("Checking prerequisites...")
    ok, msg = check_prerequisites()
    if not ok:
        logger.error(f"Prerequisites check failed: {msg}")
        sys.exit(1)
    
    # Get or clone CPython repository
    if args.repo_path is None:
        repo_path = Path(tempfile.mkdtemp(prefix='cpython_'))
        logger.info(f"Cloning CPython repository to {repo_path}")
        try:
            repo = git.Repo.clone_from('https://github.com/python/cpython.git', repo_path)
        except git.GitCommandError as e:
            logger.error(f"Failed to clone CPython repository: {e}")
            sys.exit(1)
    else:
        repo_path = args.repo_path.resolve()  # Get absolute path
        try:
            repo = git.Repo(repo_path)
        except git.InvalidGitRepositoryError:
            logger.error(f"Invalid Git repository: {repo_path}")
            sys.exit(1)
    
    # Validate commit range
    logger.info("Validating commit expression...")
    ok, msg = validate_commit_range(repo, args.commit_range)
    if not ok:
        logger.error(f"Commit expression validation failed: {msg}")
        sys.exit(1)
    
    # Check output directory
    logger.info("Checking output directory...")
    ok, msg = check_output_directory(args.output_dir.resolve())  # Get absolute path
    if not ok:
        logger.error(f"Output directory check failed: {msg}")
        sys.exit(1)
    
    # Check build environment
    logger.info("Checking build environment...")
    ok, msg = check_build_environment(repo_path)
    if not ok:
        logger.error(f"Build environment check failed: {msg}")
        sys.exit(1)
    
    # Get commits to process
    try:
        commits = get_commits_to_process(repo, args.commit_range)
    except ValueError as e:
        logger.error(f"Failed to get commits: {e}")
        sys.exit(1)
    
    logger.info("Configuration:")
    logger.info(f"Repository: {repo_path}")
    logger.info(f"Commit expression: {args.commit_range}")
    logger.info(f"Output directory: {args.output_dir}")
    logger.info(f"Configure flags: {args.configure_flags}")
    logger.info(f"Make flags: {args.make_flags}")
    logger.info(f"Number of commits to process: {len(commits)}")
    if len(commits) > 0:
        logger.info("Commits to process:")
        for commit in commits:
            logger.info(f"  {commit.hexsha[:8]} - {commit.message.splitlines()[0]}")
    
    # Process commits sequentially
    errors = []
    for commit in commits:
        error = process_commit(
            commit,
            repo_path,
            args.output_dir,
            args.configure_flags,
            args.make_flags,
            args.verbose
        )
        if error:
            errors.append((commit, error))
    
    # Print final status
    if errors:
        logger.error("Build Summary (with errors):")
        for commit, error in errors:
            logger.error(f"Failed {commit.hexsha[:8]} - {error}")
    else:
        logger.info("Build Summary (all successful):")
        for commit in commits:
            logger.info(f"Success {commit.hexsha[:8]}")

if __name__ == '__main__':
    main() 