# Spec file is needed to build a rpm package
Name:           griffin
Version:        %{_version}
Release:        1%{?dist}
Summary:        A CLI for managing version-controlled config and secrets using cloud services (such as AWS SSM).
BuildArch:      x86_64
Buildroot:      %{_tmppath}/%{name}-%{version}-root

License:        MIT
URL:           https://github.com/griffin-cli/griffin-cli
Source:        %{name}-%{version}-linux-x64.tar.gz


# Disable Fedora's shebang mangling script,
# which errors out on any file with versionless `python` in its shebang
# See: https://github.com/atom/atom/issues/21937
%undefine __brp_mangle_shebangs
# Disable debug package
%global debug_package %{nil}

%description
Griffin allows you to version control your config and secrets using cloud-backed services (such as AWS SSM).

%prep
%setup -q -n %{name}

%build

%install
rm -rf %{buildroot}/%{name}-%{version}
mkdir -p %{buildroot}/usr/local/lib/%{name}
mkdir -p %{buildroot}/usr/local/bin
cp -a $RPM_BUILD_DIR/%{name}/* %{buildroot}/usr/local/lib/%{name}

%clean
rm -rf %{buildroot}/%{name}-%{version}
# rm -rf $RPM_BUILD_DIR

%post
ln -sf /usr/local/lib/%{name}/bin/%{name} /usr/local/bin/%{name}
cd /usr/local/lib/%{name}
PATH=$PATH:$PWD/bin eval $(PATH=$PATH:$PWD/bin node -p "require('./package').scripts.welcome")

%postun
rm -f /usr/local/bin/%{name}

%files
%defattr(-,root,root,-)
%license LICENSE
%doc README.md
%{_prefix}

%changelog