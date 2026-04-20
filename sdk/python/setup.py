from setuptools import find_packages, setup

setup(
    name="bridgex-sdk",
    version="0.1.0",
    description="BridgeX Open Banking Connector - Python SDK",
    author="Abrar Ahmed",
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    python_requires=">=3.9",
    install_requires=["requests>=2.31.0"],
)
