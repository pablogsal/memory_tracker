import json
import logging
import shutil
import subprocess
from pathlib import Path
from typing import Dict, Any
import tempfile
import git

logger = logging.getLogger(__name__)

def get_sysconfig_info(python_path: Path, commit: git.Commit) -> Dict[str, Any]:
    """Get system configuration information from Python."""
    cmd = [
        str(python_path),
        '-c',
        """
import json
import sysconfig
import sys
import platform

info = {
    'version': {
        'full': sys.version,
        'major': sys.version_info.major,
        'minor': sys.version_info.minor,
        'micro': sys.version_info.micro,
        'releaselevel': sys.version_info.releaselevel,
        'serial': sys.version_info.serial,
        'hexversion': sys.hexversion
    },
    'configure_vars': sysconfig.get_config_vars(),
    'platform': sys.platform,
    'implementation': sys.implementation.name,
    'compiler': {
        'name': platform.python_compiler(),
        'version': platform.python_compiler().split()[1] if len(platform.python_compiler().split()) > 1 else None
    },
    'build_info': {
        'build_date': sysconfig.get_config_var('BUILD_DATE'),
        'build_platform': sysconfig.get_config_var('BUILD_PLATFORM'),
        'build_compiler': sysconfig.get_config_var('BUILD_COMPILER'),
        'build_cflags': sysconfig.get_config_var('CFLAGS'),
        'build_ldflags': sysconfig.get_config_var('LDFLAGS'),
    }
}

print(json.dumps(info))
"""
    ]
    
    try:
        result = subprocess.run(cmd, capture_output=True, check=True)
        info = json.loads(result.stdout.decode())
        
        # Add commit information
        info['commit'] = {
            'hexsha': commit.hexsha,
            'short_hexsha': commit.hexsha[:8],
            'author': commit.author.name,
            'author_email': commit.author.email,
            'authored_date': commit.authored_datetime.isoformat(),
            'committer': commit.committer.name,
            'committer_email': commit.committer.email,
            'committed_date': commit.committed_datetime.isoformat(),
            'message': commit.message
        }
        
        return info
    except subprocess.CalledProcessError as e:
        logger.error(f"Failed to get sysconfig info: {e}")
        if e.stdout:
            logger.error(f"stdout: {e.stdout.decode() if isinstance(e.stdout, bytes) else e.stdout}")
        if e.stderr:
            logger.error(f"stderr: {e.stderr.decode() if isinstance(e.stderr, bytes) else e.stderr}")
        raise
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse sysconfig info: {e}")
        raise

def run_benchmarks(venv_dir: Path, output_dir: Path, commit: git.Commit) -> None:
    """Run benchmarks using the virtual environment."""
    python_path = venv_dir / 'bin' / 'python'
    memray_path = venv_dir / 'bin' / 'memray'
    
    if not python_path.exists():
        raise FileNotFoundError(f"Python executable not found at {python_path}")
    if not memray_path.exists():
        raise FileNotFoundError(f"Memray executable not found at {memray_path}")
    
    # Get system configuration
    logger.info("Getting system configuration...")
    sysconfig_info = get_sysconfig_info(python_path, commit)
    
    # Save system configuration
    config_file = output_dir / 'metadata.json'
    with open(config_file, 'w') as f:
        json.dump(sysconfig_info, f, indent=2)
    logger.info(f"Saved metadata to {config_file}")
    
    # Create temporary directory for benchmark files
    temp_dir = Path(tempfile.mkdtemp(prefix='benchmarks_'))
    try:
        # Copy benchmark files to temporary directory
        benchmarks_dir = Path(__file__).parent
        for benchmark_file in benchmarks_dir.glob('*.py'):
            if benchmark_file.name == '__init__.py':
                continue
                
            # Copy benchmark file
            dest_file = temp_dir / benchmark_file.name
            shutil.copy2(benchmark_file, dest_file)
            logger.info(f"Copied benchmark {benchmark_file.name} to temporary directory")
            
            # Run benchmark with memray
            benchmark_name = benchmark_file.stem
            logger.info(f"Running benchmark: {benchmark_name}")
            
            # Run memray
            memray_output = output_dir / f"{benchmark_name}.bin"
            try:
                result = subprocess.run([
                    str(memray_path), 'run',
                    '--output', str(memray_output),
                    str(dest_file)
                ], capture_output=True, check=True)
                
                if result.stdout:
                    logger.debug(f"Memray stdout:\n{result.stdout.decode() if isinstance(result.stdout, bytes) else result.stdout}")
                if result.stderr:
                    logger.debug(f"Memray stderr:\n{result.stderr.decode() if isinstance(result.stderr, bytes) else result.stderr}")
                
                # Generate stats
                stats_output = output_dir / f"{benchmark_name}_stats.json"
                result = subprocess.run([
                    str(memray_path), 'stats',
                    '--json',
                    '--output', str(stats_output),
                    str(memray_output)
                ], capture_output=True, check=True)
                
                if result.stdout:
                    logger.debug(f"Stats stdout:\n{result.stdout.decode() if isinstance(result.stdout, bytes) else result.stdout}")
                if result.stderr:
                    logger.debug(f"Stats stderr:\n{result.stderr.decode() if isinstance(result.stderr, bytes) else result.stderr}")
                
                # Generate flamegraph
                flamegraph_output = output_dir / f"{benchmark_name}_flamegraph.html"
                result = subprocess.run([
                    str(memray_path), 'flamegraph',
                    '--output', str(flamegraph_output),
                    str(memray_output)
                ], capture_output=True, check=True)
                
                if result.stdout:
                    logger.debug(f"Flamegraph stdout:\n{result.stdout.decode() if isinstance(result.stdout, bytes) else result.stdout}")
                if result.stderr:
                    logger.debug(f"Flamegraph stderr:\n{result.stderr.decode() if isinstance(result.stderr, bytes) else result.stderr}")
                    
            except subprocess.CalledProcessError as e:
                logger.error(f"Failed to run benchmark {benchmark_name}: {e}")
                if e.stdout:
                    logger.error(f"stdout: {e.stdout.decode() if isinstance(e.stdout, bytes) else e.stdout}")
                if e.stderr:
                    logger.error(f"stderr: {e.stderr.decode() if isinstance(e.stderr, bytes) else e.stderr}")
                raise
    finally:
        # Clean up temporary directory
        if temp_dir.exists():
            shutil.rmtree(temp_dir)
            logger.debug(f"Cleaned up temporary directory: {temp_dir}") 