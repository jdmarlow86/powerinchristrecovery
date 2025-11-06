    document.getElementById('year').textContent = new Date().getFullYear();

    const support = document.querySelector('[data-support]');
    if (support) {
      const button = support.querySelector('.support__button');
      const content = support.querySelector('[data-support-content]');
      let previousPopup = null;

      if (!button || !content) {
        if (content) {
          content.hidden = false;
          content.removeAttribute('hidden');
        }
      } else {
        const stylesheet = document.querySelector('link[rel="stylesheet"][href$="styles.css"]');

        const getPopupMarkup = () => {
          const clone = content.cloneNode(true);
          clone.removeAttribute('hidden');
          clone.querySelectorAll('[data-hide-in-popup]').forEach((node) => node.remove());
          return clone.innerHTML;
        };

        const showInlineSupport = () => {
          content.hidden = false;
          content.removeAttribute('hidden');
          button.setAttribute('aria-expanded', 'true');
        };

        const hideInlineSupport = () => {
          content.hidden = true;
          content.setAttribute('hidden', '');
          button.setAttribute('aria-expanded', 'false');
        };

        const openSupportWindow = () => {
          const width = 480;
          const height = 520;
          const left = Math.round(window.screenX + Math.max((window.outerWidth - width) / 2, 0));
          const top = Math.round(window.screenY + Math.max((window.outerHeight - height) / 2, 0));
          const features = `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`;
          if (previousPopup && !previousPopup.closed) {
            try {
              previousPopup.close();
            } catch (error) {
              console.error('Unable to close previous support window:', error);
            }
          }

          const popupName = `supportOptions-${Date.now()}`;
          const popup = window.open('', popupName, features);

          if (!popup) {
            return null;
          }

          const markup = getPopupMarkup();
          const stylesheetHref = stylesheet ? stylesheet.getAttribute('href') : null;

          try {
            popup.document.open();
            popup.document.write(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Support This Ministry</title>
    ${stylesheetHref ? `<link rel="stylesheet" href="${stylesheetHref}">` : ''}
  </head>
  <body class="support__window">
    <main class="support__window-main">
      ${markup}
    </main>
  </body>
</html>`);
            popup.document.close();

            popup.addEventListener('load', () => {
              const firstLink = popup.document.querySelector('.support__list a');
              if (firstLink) {
                firstLink.focus();
              }
            });

            popup.focus();
            previousPopup = popup;
            return popup;
          } catch (error) {
            console.error('Unable to render support window:', error);
            try {
              popup.close();
            } catch (closeError) {
              console.error('Unable to close failed support window:', closeError);
            }
            return null;
          }
        };

        button.addEventListener('click', () => {
          const popup = openSupportWindow();

          if (!popup) {
            if (content.hasAttribute('hidden')) {
              showInlineSupport();
            } else {
              hideInlineSupport();
            }
          } else {
            hideInlineSupport();
          }
        });
      }
    }

    window.addEventListener('unhandledrejection', (event) => {
      const reason = event?.reason;
      if (reason && /MetaMask extension not found/i.test(reason.message || reason)) {
        event.preventDefault();
        console.info('MetaMask extension not detected; wallet connection skipped.');
      }
    });

    const newsletterForm = document.querySelector('[data-newsletter-form]');
    if (newsletterForm) {
      const emailInput = newsletterForm.querySelector('input[type="email"]');
      const message = newsletterForm.querySelector('[data-newsletter-message]');
      const errorMessage = newsletterForm.querySelector('[data-newsletter-error]');
      const submitButton = newsletterForm.querySelector('button[type="submit"]');
      const submitButtonLabel = submitButton ? submitButton.textContent : '';

      const toggleMessage = (element, shouldShow) => {
        if (!element) return;
        element.hidden = !shouldShow;
      };

      const sendWelcomeEmail = async (emailAddress) => {
        const endpointBase = 'https://formsubmit.co/ajax/';
        const welcomeLines = [
          'Hi there,',
          '',
          'Thank you for signing up to receive weekly encouragement from Power in Christ Recovery.',
          'We are honored to walk alongside you in prayer, Scripture reflection, and Christ-centered support.',
          '',
          'Each week you can expect:',
          '• A short devotional focus rooted in God\'s Word.',
          '• A prayer prompt to carry with you through the week.',
          '• Ministry updates and opportunities to stay connected.',
          '',
          'We are praying for you. May the peace of Christ guard your heart as you continue this journey toward freedom.',
          '',
          'Grace and peace,',
          'Power in Christ Recovery'
        ];

        const payload = {
          email: emailAddress,
          message: welcomeLines.join('\n'),
          _subject: 'Welcome to Power in Christ Recovery',
          _bcc: 'jonmarlow@gmail.com',
          _template: 'table'
        };

        const response = await fetch(`${endpointBase}${encodeURIComponent(emailAddress)}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          throw new Error('Failed to send welcome email');
        }

        return response.json();
      };

      newsletterForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        if (emailInput && !emailInput.checkValidity()) {
          emailInput.reportValidity();
          return;
        }

        const emailAddress = emailInput ? emailInput.value.trim() : '';
        if (!emailAddress) {
          return;
        }

        toggleMessage(message, false);
        toggleMessage(errorMessage, false);

        if (submitButton) {
          submitButton.disabled = true;
          submitButton.textContent = 'Sending…';
        }

        try {
          await sendWelcomeEmail(emailAddress);
          newsletterForm.reset();
          toggleMessage(message, true);
        } catch (error) {
          console.error('Newsletter signup error:', error);
          toggleMessage(errorMessage, true);
          if (emailInput) {
            emailInput.focus();
          }
        } finally {
          if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = submitButtonLabel;
          }

          window.setTimeout(() => {
            toggleMessage(message, false);
            toggleMessage(errorMessage, false);
          }, 8000);
        }
      });
    }

    const affiliateSection = document.querySelector('[data-affiliates]');
    if (affiliateSection) {
      const AFFILIATE_STORAGE_KEY = 'picr:affiliates';
      const AFFILIATE_ADMIN_KEY = 'picr:affiliates-admin';
      const list = affiliateSection.querySelector('[data-affiliates-list]');
      const emptyState = affiliateSection.querySelector('[data-affiliates-empty]');
      const template = document.getElementById('affiliate-card-template');
      const adminButton = affiliateSection.querySelector('[data-affiliate-admin]');
      const form = affiliateSection.querySelector('[data-affiliate-form]');
      const feedback = affiliateSection.querySelector('[data-affiliate-feedback]');
      const cancelButton = affiliateSection.querySelector('[data-affiliate-cancel]');
      const passcodeHash = adminButton ? adminButton.dataset.passcodeHash : '';
      const passcodeFallback = adminButton ? adminButton.dataset.passcodeFallback : '';

      const storage = {
        read(key) {
          try {
            return window.localStorage.getItem(key);
          } catch (error) {
            console.warn('Affiliate storage read failed:', error);
            return null;
          }
        },
        write(key, value) {
          try {
            window.localStorage.setItem(key, value);
          } catch (error) {
            console.warn('Affiliate storage write failed:', error);
          }
        },
        remove(key) {
          try {
            window.localStorage.removeItem(key);
          } catch (error) {
            console.warn('Affiliate storage remove failed:', error);
          }
        }
      };

      const defaultAffiliates = [
        {
          name: 'MyBibleBelt.org',
          tagline: 'Regional discipleship resources for lasting freedom.',
          description:
            'MyBibleBelt.org provides Christ-centered recovery tools, live prayer gatherings, and on-demand discipleship support for churches and leaders across the southeastern United States.',
          website: 'https://mybiblebelt.org',
          contact: 'mybiblebelt@gmail.com'
        }
      ];

      const parseStoredAffiliates = () => {
        const stored = storage.read(AFFILIATE_STORAGE_KEY);
        if (!stored) return null;
        try {
          const parsed = JSON.parse(stored);
          return Array.isArray(parsed) ? parsed : null;
        } catch (error) {
          console.warn('Affiliate storage parse failed:', error);
          return null;
        }
      };

      const persistAffiliates = (items) => {
        storage.write(AFFILIATE_STORAGE_KEY, JSON.stringify(items));
      };

      let affiliates = parseStoredAffiliates() || defaultAffiliates.slice();
      let feedbackTimer = null;

      const clearFeedback = () => {
        if (feedbackTimer) {
          window.clearTimeout(feedbackTimer);
          feedbackTimer = null;
        }

        if (feedback) {
          feedback.textContent = '';
          feedback.hidden = true;
          feedback.removeAttribute('data-state');
        }
      };

      const showFeedback = (message, state = 'success', persist = false) => {
        if (!feedback) {
          return;
        }

        if (feedbackTimer) {
          window.clearTimeout(feedbackTimer);
          feedbackTimer = null;
        }

        feedback.textContent = message;
        feedback.hidden = false;

        if (state) {
          feedback.dataset.state = state;
        } else {
          feedback.removeAttribute('data-state');
        }

        if (!persist) {
          const duration = state === 'error' ? 8000 : 6000;
          feedbackTimer = window.setTimeout(() => {
            clearFeedback();
          }, duration);
        }
      };

      const normalizeUrl = (value) => {
        if (!value) return '';
        const trimmed = value.trim();
        if (!trimmed) return '';
        if (/^https?:\/\//i.test(trimmed)) {
          return trimmed;
        }
        return `https://${trimmed}`;
      };

      const renderAffiliates = (items) => {
        if (!list || !template) return;
        list.innerHTML = '';

        if (!items || items.length === 0) {
          if (emptyState) {
            emptyState.hidden = false;
          }
          return;
        }

        if (emptyState) {
          emptyState.hidden = true;
        }

        items.forEach((affiliate) => {
          const card = template.content.firstElementChild.cloneNode(true);
          const link = card.querySelector('[data-affiliate-link]');
          const tagline = card.querySelector('[data-affiliate-tagline]');
          const description = card.querySelector('[data-affiliate-description]');
          const website = card.querySelector('[data-affiliate-website]');
          const contact = card.querySelector('[data-affiliate-contact]');

          if (link) {
            link.textContent = affiliate.name;
            const href = normalizeUrl(affiliate.website);
            if (href) {
              link.href = href;
            } else {
              link.removeAttribute('href');
              link.removeAttribute('target');
              link.removeAttribute('rel');
            }
          }

          if (tagline) {
            if (affiliate.tagline) {
              tagline.textContent = affiliate.tagline;
              tagline.hidden = false;
            } else {
              tagline.hidden = true;
            }
          }

          if (description) {
            description.textContent = affiliate.description || '';
          }

          if (website) {
            const href = normalizeUrl(affiliate.website);
            if (href) {
              website.href = href;
              website.textContent = href.replace(/^https?:\/\//i, '');
              website.hidden = false;
            } else {
              website.hidden = true;
            }
          }

          if (contact) {
            if (affiliate.contact) {
              const emailLink = document.createElement('a');
              emailLink.href = `mailto:${affiliate.contact}`;
              emailLink.textContent = affiliate.contact;
              contact.textContent = 'Contact: ';
              contact.append(emailLink);
              contact.hidden = false;
            } else {
              contact.hidden = true;
            }
          }

          list.appendChild(card);
        });
      };

      renderAffiliates(affiliates);

      const hashValue = async (value) => {
        if (!value) return '';
        if (window.crypto && window.crypto.subtle) {
          const encoder = new TextEncoder();
          const data = encoder.encode(value);
          const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
          return Array.from(new Uint8Array(hashBuffer))
            .map((byte) => byte.toString(16).padStart(2, '0'))
            .join('');
        }

        if (passcodeFallback) {
          try {
            const decoded = atob(passcodeFallback);
            return value === decoded ? passcodeHash : '';
          } catch (error) {
            console.warn('Affiliate admin fallback decode failed:', error);
          }
        }

        return '';
      };

      let isAdmin = storage.read(AFFILIATE_ADMIN_KEY) === 'granted';

      const openAdminForm = () => {
        if (!form || !adminButton) return;
        form.hidden = false;
        adminButton.setAttribute('aria-expanded', 'true');
        adminButton.textContent = 'Admin: Hide Form';
      };

      const closeAdminForm = () => {
        if (!form || !adminButton) return;
        form.reset();
        form.hidden = true;
        adminButton.setAttribute('aria-expanded', 'false');
        adminButton.textContent = 'Admin: Add Affiliate';
        clearFeedback();
      };

      if (form && !isAdmin) {
        form.hidden = true;
      }

      if (isAdmin) {
        openAdminForm();
      }

      if (adminButton) {
        adminButton.addEventListener('click', async () => {
          if (!form) {
            return;
          }

          if (!isAdmin) {
            const input = window.prompt('Enter the admin passcode to manage affiliates:');
            if (!input) {
              return;
            }

            try {
              const hashed = await hashValue(input.trim());
              const matches = hashed === passcodeHash;

              if (matches) {
                isAdmin = true;
                storage.write(AFFILIATE_ADMIN_KEY, 'granted');
                openAdminForm();
                clearFeedback();
                showFeedback('Admin mode enabled. Add your affiliate details below.');
              } else {
                showFeedback('Incorrect passcode. Please try again.', 'error');
              }
            } catch (error) {
              console.error('Affiliate admin verification failed:', error);
              showFeedback('Unable to verify passcode. Please try again.', 'error');
            }
            return;
          }

          if (form.hidden) {
            openAdminForm();
          } else {
            closeAdminForm();
          }
        });
      }

      if (cancelButton) {
        cancelButton.addEventListener('click', () => {
          closeAdminForm();
        });
      }

      if (form) {
        form.addEventListener('submit', (event) => {
          event.preventDefault();

          if (!isAdmin) {
            showFeedback('You need the admin passcode to add affiliates.', 'error');
            return;
          }

          clearFeedback();

          const formData = new FormData(form);
          const affiliate = {
            name: (formData.get('name') || '').toString().trim(),
            tagline: (formData.get('tagline') || '').toString().trim(),
            website: (formData.get('website') || '').toString().trim(),
            contact: (formData.get('contact') || '').toString().trim(),
            description: (formData.get('description') || '').toString().trim()
          };

          if (!affiliate.name || !affiliate.description || !affiliate.website) {
            showFeedback('Name, website, and description are required.', 'error');
            return;
          }

          affiliates.push(affiliate);
          renderAffiliates(affiliates);
          persistAffiliates(affiliates);
          form.reset();
          showFeedback(`${affiliate.name} was added to the affiliate list.`);
        });
      }
    }
  
