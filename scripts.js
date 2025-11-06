(() => {
    const globalYear = document.getElementById('year');
    if (globalYear) {
      globalYear.textContent = new Date().getFullYear();
    }

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
  

    const testimonyBoard = document.querySelector('[data-testimony-board]');
    if (testimonyBoard) {
      const TESTIMONY_STORAGE_KEY = 'picr:testimonies';
      const form = document.querySelector('[data-testimony-form]');
      const nameInput = form ? form.querySelector('input[name="name"]') : null;
      const storyInput = form ? form.querySelector('textarea[name="story"]') : null;
      const successFeedback = form ? form.querySelector('[data-testimony-feedback]') : null;
      const errorFeedback = form ? form.querySelector('[data-testimony-error]') : null;
      const list = testimonyBoard.querySelector('[data-testimony-list]');
      const emptyState = testimonyBoard.querySelector('[data-testimony-empty]');
      const announcer = testimonyBoard.querySelector('[data-testimony-announcer]');

      if (!list) {
        console.warn('Testimony wall could not find a list container.');
        return;
      }

      let storageEnabled = true;
      let feedbackTimer = null;

      const createId = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

      const readFromStorage = () => {
        if (!storageEnabled) {
          return null;
        }
        try {
          return window.localStorage.getItem(TESTIMONY_STORAGE_KEY);
        } catch (error) {
          console.warn('Testimony storage read failed:', error);
          storageEnabled = false;
          return null;
        }
      };

      const writeToStorage = (items) => {
        if (!storageEnabled) {
          return;
        }
        try {
          window.localStorage.setItem(TESTIMONY_STORAGE_KEY, JSON.stringify(items));
        } catch (error) {
          console.warn('Testimony storage write failed:', error);
          storageEnabled = false;
        }
      };

      const formatTimestamp = (value) => {
        if (!value) {
          return '';
        }
        try {
          return new Intl.DateTimeFormat('en-US', {
            dateStyle: 'medium',
            timeStyle: 'short'
          }).format(new Date(value));
        } catch (error) {
          console.warn('Unable to format testimony timestamp:', error);
          return '';
        }
      };

      const announce = (message) => {
        if (!announcer || !message) {
          return;
        }
        announcer.textContent = '';
        window.requestAnimationFrame(() => {
          announcer.textContent = message;
        });
      };

      const normalizeComment = (comment) => {
        if (!comment) {
          return null;
        }
        const body = typeof comment.message === 'string' ? comment.message.trim() : '';
        if (!body) {
          return null;
        }
        return {
          id: comment.id || createId('c'),
          author: typeof comment.author === 'string' ? comment.author.trim() : '',
          message: body,
          createdAt: comment.createdAt || new Date().toISOString()
        };
      };

      const normalizeTestimony = (entry) => {
        if (!entry) {
          return null;
        }
        const message = typeof entry.message === 'string' ? entry.message.trim() : '';
        if (!message) {
          return null;
        }
        const comments = Array.isArray(entry.comments)
          ? entry.comments.map((comment) => normalizeComment(comment)).filter(Boolean)
          : [];
        return {
          id: entry.id || createId('t'),
          author: typeof entry.author === 'string' ? entry.author.trim() : '',
          message,
          createdAt: entry.createdAt || new Date().toISOString(),
          comments
        };
      };

      const sortTestimonies = (items) =>
        items
          .slice()
          .sort(
            (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
          );

      const parseStoredTestimonies = () => {
        const stored = readFromStorage();
        if (!stored) {
          return null;
        }
        try {
          const parsed = JSON.parse(stored);
          return Array.isArray(parsed) ? parsed : null;
        } catch (error) {
          console.warn('Testimony storage parse failed:', error);
          return null;
        }
      };

      const defaultTestimonies = [];

      let testimonies = sortTestimonies(
        (parseStoredTestimonies() || defaultTestimonies).map((entry) => normalizeTestimony(entry)).filter(Boolean)
      );

      const persistTestimonies = (items) => {
        writeToStorage(items);
      };

      const showFormFeedback = (message, type = 'success') => {
        if (feedbackTimer) {
          window.clearTimeout(feedbackTimer);
          feedbackTimer = null;
        }

        if (successFeedback) {
          successFeedback.hidden = true;
          successFeedback.textContent = '';
        }

        if (errorFeedback) {
          errorFeedback.hidden = true;
          errorFeedback.textContent = '';
        }

        if (!message) {
          return;
        }

        const target = type === 'error' ? errorFeedback : successFeedback;
        if (!target) {
          return;
        }

        target.textContent = message;
        target.hidden = false;

        const duration = type === 'error' ? 9000 : 6000;
        feedbackTimer = window.setTimeout(() => {
          target.hidden = true;
          target.textContent = '';
          feedbackTimer = null;
        }, duration);
      };

      const createTestimonyCard = (testimony) => {
        const article = document.createElement('article');
        article.className = 'testimony-card';
        article.dataset.testimonyId = testimony.id;

        const header = document.createElement('header');
        header.className = 'testimony-card__header';

        const title = document.createElement('h3');
        title.className = 'testimony-card__name';
        title.textContent = testimony.author || 'Anonymous';
        header.append(title);

        const meta = document.createElement('p');
        meta.className = 'testimony-card__meta';
        meta.textContent = formatTimestamp(testimony.createdAt);
        if (meta.textContent) {
          header.append(meta);
        }

        const message = document.createElement('p');
        message.className = 'testimony-card__message';
        message.textContent = testimony.message;

        article.append(header, message);

        const commentsSection = document.createElement('section');
        commentsSection.className = 'testimony-card__comments';

        const commentsTitle = document.createElement('h4');
        commentsTitle.className = 'testimony-card__comments-title';
        const commentCount = testimony.comments.length;
        commentsTitle.textContent =
          commentCount === 0 ? 'Comments' : `${commentCount} ${commentCount === 1 ? 'Comment' : 'Comments'}`;
        commentsSection.append(commentsTitle);

        const commentsList = document.createElement('ul');
        commentsList.className = 'comment-list';
        commentsSection.append(commentsList);

        testimony.comments.forEach((comment) => {
          const item = document.createElement('li');
          item.className = 'comment';
          item.dataset.commentItem = 'true';
          item.dataset.commentId = comment.id;

          const commentMeta = document.createElement('p');
          commentMeta.className = 'comment__meta';

          const author = document.createElement('span');
          author.className = 'comment__author';
          author.textContent = comment.author || 'Anonymous';
          commentMeta.append(author);

          const timeText = formatTimestamp(comment.createdAt);
          if (timeText) {
            const separator = document.createElement('span');
            separator.setAttribute('aria-hidden', 'true');
            separator.textContent = '•';
            const time = document.createElement('span');
            time.textContent = timeText;
            commentMeta.append(separator, time);
          }

          item.append(commentMeta);

          const body = document.createElement('p');
          body.className = 'comment__message';
          body.textContent = comment.message;
          item.append(body);

          commentsList.append(item);
        });

        if (commentCount === 0) {
          const commentHint = document.createElement('p');
          commentHint.className = 'comment-form__note';
          commentHint.textContent = 'Be the first to encourage this story.';
          commentsSection.append(commentHint);
        }

        const commentForm = document.createElement('form');
        commentForm.className = 'comment-form';
        commentForm.setAttribute(
          'aria-label',
          `Leave a comment on ${testimony.author ? `${testimony.author}'s` : 'this'} testimony`
        );

        const formGrid = document.createElement('div');
        formGrid.className = 'comment-form__grid';

        const commentNameField = document.createElement('div');
        commentNameField.className = 'comment-form__field';
        const commentNameLabel = document.createElement('label');
        const nameFieldId = `comment-name-${testimony.id}`;
        commentNameLabel.className = 'comment-form__label';
        commentNameLabel.setAttribute('for', nameFieldId);
        commentNameLabel.textContent = 'Name (optional)';
        const commentNameInput = document.createElement('input');
        commentNameInput.className = 'comment-form__input';
        commentNameInput.type = 'text';
        commentNameInput.id = nameFieldId;
        commentNameInput.name = 'name';
        commentNameInput.maxLength = 80;
        commentNameInput.placeholder = 'Add your name';
        commentNameField.append(commentNameLabel, commentNameInput);

        const commentMessageField = document.createElement('div');
        commentMessageField.className = 'comment-form__field comment-form__field--full';
        const messageFieldId = `comment-message-${testimony.id}`;
        const commentMessageLabel = document.createElement('label');
        commentMessageLabel.className = 'comment-form__label';
        commentMessageLabel.setAttribute('for', messageFieldId);
        commentMessageLabel.textContent = 'Comment';
        const commentMessageInput = document.createElement('textarea');
        commentMessageInput.className = 'comment-form__textarea';
        commentMessageInput.id = messageFieldId;
        commentMessageInput.name = 'message';
        commentMessageInput.rows = 3;
        commentMessageInput.required = true;
        commentMessageInput.maxLength = 600;
        commentMessageInput.placeholder = 'Share encouragement or a prayer.';
        commentMessageField.append(commentMessageLabel, commentMessageInput);

        formGrid.append(commentNameField, commentMessageField);
        commentForm.append(formGrid);

        const formActions = document.createElement('div');
        formActions.className = 'comment-form__actions';
        const submitButton = document.createElement('button');
        submitButton.className = 'comment-form__button';
        submitButton.type = 'submit';
        submitButton.textContent = 'Post Comment';
        formActions.append(submitButton);
        commentForm.append(formActions);

        commentForm.addEventListener('submit', (event) => {
          event.preventDefault();

          const authorValue = commentNameInput.value.trim();
          const messageValue = commentMessageInput.value.trim();

          if (!messageValue) {
            commentMessageInput.setCustomValidity('Please share a short comment before posting.');
            commentMessageInput.reportValidity();
            commentMessageInput.setCustomValidity('');
            return;
          }

          const newComment = {
            id: createId('c'),
            author: authorValue,
            message: messageValue,
            createdAt: new Date().toISOString()
          };

          testimonies = testimonies.map((item) => {
            if (item.id !== testimony.id) {
              return item;
            }
            return { ...item, comments: [...item.comments, newComment] };
          });

          persistTestimonies(testimonies);
          renderTestimonies();
          commentNameInput.value = '';
          commentMessageInput.value = '';
          announce(`New comment posted${authorValue ? ` by ${authorValue}` : ''}.`);

          window.requestAnimationFrame(() => {
            if (!list) {
              return;
            }
            const updatedCard = list.querySelector(`[data-testimony-id="${testimony.id}"]`);
            if (!updatedCard) {
              return;
            }
            const newCommentNode = updatedCard.querySelector(`[data-comment-id="${newComment.id}"]`);
            if (newCommentNode) {
              newCommentNode.classList.add('comment--highlight');
              newCommentNode.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              window.setTimeout(() => {
                newCommentNode.classList.remove('comment--highlight');
              }, 4000);
            }
            const commentField = updatedCard.querySelector(`#${messageFieldId}`);
            if (commentField) {
              commentField.focus();
            }
          });
        });

        commentsSection.append(commentForm);
        article.append(commentsSection);

        return article;
      };

      const renderTestimonies = () => {
        if (!list) {
          return;
        }

        list.innerHTML = '';

        if (!testimonies.length) {
          if (emptyState) {
            emptyState.hidden = false;
          }
          return;
        }

        if (emptyState) {
          emptyState.hidden = true;
        }

        testimonies.forEach((testimony) => {
          list.append(createTestimonyCard(testimony));
        });
      };

      renderTestimonies();

      if (form) {
        form.addEventListener('submit', (event) => {
          event.preventDefault();

          const nameValue = nameInput ? nameInput.value.trim() : '';
          const storyValue = storyInput ? storyInput.value.trim() : '';

          if (!storyValue) {
            if (storyInput) {
              storyInput.setCustomValidity('Please share a brief testimony before posting.');
              storyInput.reportValidity();
              storyInput.setCustomValidity('');
              storyInput.focus();
            }
            showFormFeedback('Please share a brief testimony before posting.', 'error');
            return;
          }

          if (storyValue.length < 12) {
            if (storyInput) {
              storyInput.setCustomValidity('Please share a few more details (at least 12 characters).');
              storyInput.reportValidity();
              storyInput.setCustomValidity('');
              storyInput.focus();
            }
            showFormFeedback('Please share a few more details (at least 12 characters).', 'error');
            return;
          }

          const newTestimony = {
            id: createId('t'),
            author: nameValue,
            message: storyValue,
            createdAt: new Date().toISOString(),
            comments: []
          };

          testimonies = sortTestimonies([newTestimony, ...testimonies]);
          persistTestimonies(testimonies);
          renderTestimonies();

          if (form) {
            form.reset();
          }

          showFormFeedback('Thank you for sharing! Your testimony has been posted.');
          announce('Testimony posted to the community wall.');

          window.requestAnimationFrame(() => {
            if (!list) {
              return;
            }
            const newCard = list.querySelector(`[data-testimony-id="${newTestimony.id}"]`);
            if (newCard) {
              newCard.classList.add('testimony-card--highlight');
              newCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
              window.setTimeout(() => {
                newCard.classList.remove('testimony-card--highlight');
              }, 6000);

              const commentTextarea = newCard.querySelector('textarea[name="message"]');
              if (commentTextarea) {
                commentTextarea.focus();
              }
            }
          });
        });
      }
    }

})();
